import { NextResponse } from "next/server";
import { getClient, buildState, routeDecision } from "@/lib/jev";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// symbol -> CoinGecko coin id
const WATCHLIST: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  AVAXUSDT: "avalanche-2",
};
const STARTING_EQUITY = 10000;

const priceCache = new Map<string, number>();

async function loadPrices(): Promise<Record<string, number>> {
  const ids = Object.values(WATCHLIST).join(",");
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch prices: ${res.status}`);
  const data = await res.json();
  const bySymbol: Record<string, number> = {};
  for (const [symbol, coinId] of Object.entries(WATCHLIST)) {
    const price = data[coinId]?.usd;
    if (price != null) bySymbol[symbol] = Number(price);
  }
  return bySymbol;
}

// GET /api/tick — read-only market data in (CoinGecko, no region restrictions), Jev
// triage/sizing/approval decisions logged. Does NOT open simulated positions yet:
// Jev is a router and deliberately never decides market direction, and no separate
// forecasting module exists in this project yet to supply one. This endpoint only
// reads public market data and writes decision/telemetry rows — safe to run on a
// schedule as-is.
export async function GET() {
  if (process.env.KILL_SWITCH === "true") {
    return NextResponse.json({ status: "killed", message: "KILL_SWITCH is active. No action taken." });
  }

  const client = getClient();
  const results: any[] = [];

  let prices: Record<string, number> = {};
  try {
    prices = await loadPrices();
  } catch (err: any) {
    return NextResponse.json({ status: "error", message: `Price fetch failed: ${err.message}` }, { status: 502 });
  }

  for (const symbol of Object.keys(WATCHLIST)) {
    const markPrice = prices[symbol];
    if (markPrice == null) {
      results.push({ symbol, error: "no price available this tick" });
      continue;
    }
    try {
      const openPositions = await query<any>(
        "SELECT * FROM positions WHERE symbol = $1 AND status = 'open'",
        [symbol]
      );

      const state = buildState(
        { question: `${symbol} perpetual, current state`, hoursToResolution: 1 },
        { markPrice },
        openPositions[0] ?? { size: 0 }
      );

      const decision: any = await routeDecision(client, state);
      const answers = decision?.answers ?? {};

      // NOTE: field names below follow the documented System One response shape
      // (answers.<id>.noul / .score / .confidence). Verify against the live API
      // response on first run and adjust here if the JS SDK shapes this differently.
      const needsResearch = answers.needs_research?.noul ?? null;
      const sizeScore = answers.size_tier?.score ?? null;
      const sizeConfidence = answers.size_tier?.confidence ?? null;
      const needsApproval = answers.needs_human_approval?.noul ?? null;
      const sizeTier = sizeScore != null ? Math.round(sizeScore) : null;

      await query(
        `INSERT INTO ai_decisions (symbol, needs_research, size_tier, needs_human_approval, confidence, raw_state)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          symbol,
          needsResearch != null ? needsResearch > 0.5 : null,
          sizeTier,
          needsApproval != null ? needsApproval > 0.5 : null,
          sizeConfidence,
          JSON.stringify({ state, answers }),
        ]
      );

      results.push({ symbol, markPrice, sizeTier, needsApproval, action: "logged_only" });
    } catch (err: any) {
      results.push({ symbol, error: err.message });
    }
  }

  const openRows = await query<any>("SELECT * FROM positions WHERE status = 'open'");
  let unrealized = 0;
  for (const p of openRows) {
    const price = prices[p.symbol];
    if (price == null) continue;
    const direction = p.side === "long" ? 1 : -1;
    unrealized += direction * (price - Number(p.entry_price)) * Number(p.size);
  }
  const realizedRows = await query<any>("SELECT COALESCE(SUM(pnl), 0) as total FROM fills");
  const realized = Number(realizedRows[0]?.total ?? 0);
  const equity = STARTING_EQUITY + realized + unrealized;

  await query(
    `INSERT INTO performance_snapshots (equity, realized_pnl, unrealized_pnl, win_rate) VALUES ($1, $2, $3, $4)`,
    [equity, realized, unrealized, null]
  );

  return NextResponse.json({ status: "ok", results, equity });
}
