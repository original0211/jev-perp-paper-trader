import { NextRequest, NextResponse } from "next/server";
import { getClient, buildState, routeDecision } from "@/lib/jev";
import { query } from "@/lib/db";
import { RISK_LIMITS, sizeTierToUsd } from "@/lib/risk";
import { simulateFill } from "@/lib/paper-engine";
import { computeMomentum, MOMENTUM_LOOKBACK_TICKS } from "@/lib/momentum";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// symbol -> CoinGecko coin id
const WATCHLIST: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  AVAXUSDT: "avalanche-2",
};
const STARTING_EQUITY = 10000;

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

// GET /api/tick — called by Vercel Cron (daily, see vercel.json) or manually for testing.
// Requires Authorization: Bearer <CRON_SECRET> in production. Flow each run:
//   1. Check every OPEN position against stop-loss/take-profit and auto-close if hit.
//   2. Fetch prices, log a price tick, compute momentum direction (lib/momentum.ts).
//   3. Route through Jev for triage/sizing/approval (Jev never decides direction).
//   4. Open a new simulated position only if Jev sizing + momentum direction + risk
//      limits all agree.
//   5. Snapshot total equity.
// Simulation only — no real exchange account or funds are touched anywhere in this file.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (process.env.KILL_SWITCH === "true") {
    return NextResponse.json({ status: "killed", message: "KILL_SWITCH is active. No action taken." });
  }

  let prices: Record<string, number> = {};
  try {
    prices = await loadPrices();
  } catch (err: any) {
    return NextResponse.json({ status: "error", message: `Price fetch failed: ${err.message}` }, { status: 502 });
  }

  // Step 1: check open positions for stop-loss / take-profit, close if triggered.
  const closedThisRun: any[] = [];
  const openBefore = await query<any>("SELECT * FROM positions WHERE status = 'open'");
  for (const p of openBefore) {
    const price = prices[p.symbol];
    if (price == null) continue;
    const direction = p.side === "long" ? 1 : -1;
    const entry = Number(p.entry_price);
    const size = Number(p.size);
    const pnlPct = (direction * (price - entry)) / entry;

    if (pnlPct <= -RISK_LIMITS.STOP_LOSS_PCT || pnlPct >= RISK_LIMITS.TAKE_PROFIT_PCT) {
      const pnlUsd = direction * (price - entry) * size;
      await query("UPDATE positions SET status = 'closed', closed_at = now() WHERE id = $1", [p.id]);
      await query("INSERT INTO fills (symbol, action, price, size, pnl) VALUES ($1, $2, $3, $4, $5)", [
        p.symbol,
        "close",
        price,
        size,
        pnlUsd,
      ]);
      closedThisRun.push({ symbol: p.symbol, reason: pnlPct <= -RISK_LIMITS.STOP_LOSS_PCT ? "stop_loss" : "take_profit", pnlPct, pnlUsd });
    }
  }

  const client = getClient();
  const results: any[] = [];

  for (const symbol of Object.keys(WATCHLIST)) {
    const markPrice = prices[symbol];
    if (markPrice == null) {
      results.push({ symbol, error: "no price available this tick" });
      continue;
    }
    try {
      await query("INSERT INTO price_ticks (symbol, price) VALUES ($1, $2)", [symbol, markPrice]);

      const recentTicks = await query<{ price: string; recorded_at: string }>(
        "SELECT price, recorded_at FROM price_ticks WHERE symbol = $1 ORDER BY recorded_at DESC LIMIT $2",
        [symbol, MOMENTUM_LOOKBACK_TICKS]
      );
      const momentum = computeMomentum(
        recentTicks.map((t) => ({ price: Number(t.price), recorded_at: t.recorded_at }))
      );

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
          JSON.stringify({ state, answers, momentum }),
        ]
      );

      let action = "logged_only";

      const openCountRows = await query<{ count: string }>(
        "SELECT COUNT(*) as count FROM positions WHERE status = 'open'"
      );
      const openCount = Number(openCountRows[0]?.count ?? 0);

      const canOpen =
        sizeTier != null &&
        sizeTier > 0 &&
        needsApproval != null &&
        needsApproval <= 0.5 &&
        momentum.direction != null &&
        openPositions.length === 0 &&
        openCount < RISK_LIMITS.MAX_CONCURRENT_POSITIONS;

      if (canOpen) {
        const usdSize = Math.min(sizeTierToUsd(sizeTier!), RISK_LIMITS.MAX_USD_PER_MARKET);
        const { position, fill } = simulateFill(symbol, momentum.direction!, usdSize, markPrice);

        await query("INSERT INTO positions (symbol, side, entry_price, size) VALUES ($1, $2, $3, $4)", [
          position.symbol,
          position.side,
          position.entryPrice,
          position.size,
        ]);
        await query("INSERT INTO fills (symbol, action, price, size, pnl) VALUES ($1, $2, $3, $4, $5)", [
          fill.symbol,
          fill.action,
          fill.price,
          fill.size,
          fill.pnl,
        ]);
        action = "simulated_fill";
      }

      results.push({
        symbol,
        markPrice,
        sizeTier,
        needsApproval,
        momentumDirection: momentum.direction,
        momentumChangePct: momentum.changePct,
        action,
      });
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

  return NextResponse.json({ status: "ok", closedThisRun, results, equity });
}
