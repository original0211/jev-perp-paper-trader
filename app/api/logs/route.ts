import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface DecisionRow {
  symbol: string;
  decided_at: string;
  size_tier: number | null;
  confidence: string | null;
  needs_human_approval: boolean | null;
}

interface FillRow {
  symbol: string;
  filled_at: string;
  side: string | null;
  action: string;
  price: string;
  pnl: string;
}

interface LogEvent {
  ts: string;
  level: "info" | "success" | "danger" | "warn";
  text: string;
}

export async function GET() {
  const [decisions, fills] = await Promise.all([
    query<DecisionRow>(
      "SELECT symbol, decided_at, size_tier, confidence, needs_human_approval FROM ai_decisions ORDER BY decided_at DESC LIMIT 30"
    ),
    query<FillRow>(
      "SELECT symbol, filled_at, side, action, price, pnl FROM fills ORDER BY filled_at DESC LIMIT 30"
    ),
  ]);

  const events: LogEvent[] = [];

  for (const d of decisions) {
    const conf = d.confidence != null ? `${Math.round(Number(d.confidence) * 100)}%` : "-";
    const approval = d.needs_human_approval ? "需审批" : "自动";
    events.push({
      ts: d.decided_at,
      level: d.needs_human_approval ? "warn" : "info",
      text: `[决策] ${d.symbol} 档位=${d.size_tier ?? "-"} 置信=${conf} ${approval}`,
    });
  }

  for (const f of fills) {
    const sideText = f.side === "long" ? "多" : f.side === "short" ? "空" : "-";
    if (f.action === "close") {
      const pnl = Number(f.pnl);
      events.push({
        ts: f.filled_at,
        level: pnl >= 0 ? "success" : "danger",
        text: `[平仓] ${f.symbol} ${sideText} @ ${f.price} 盈亏 ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`,
      });
    } else {
      events.push({
        ts: f.filled_at,
        level: "success",
        text: `[开仓] ${f.symbol} ${sideText} @ ${f.price}`,
      });
    }
  }

  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return NextResponse.json({ events: events.slice(0, 50), serverTime: new Date().toISOString() });
}
