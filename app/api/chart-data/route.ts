import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { WATCHLIST } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

interface Point {
  time: number;
  value: number;
}

function dedupeBySecond(rows: { ts: string; value: number }[]): Point[] {
  const points: Point[] = [];
  for (const row of rows) {
    const t = Math.floor(new Date(row.ts).getTime() / 1000);
    const last = points[points.length - 1];
    if (last && last.time === t) {
      last.value = row.value;
    } else if (!last || t > last.time) {
      points.push({ time: t, value: row.value });
    }
  }
  return points;
}

export async function GET() {
  const [snapshots, priceRows] = await Promise.all([
    query<{ equity: string; snapshot_at: string }>(
      "SELECT equity, snapshot_at FROM performance_snapshots ORDER BY snapshot_at ASC LIMIT 1000"
    ),
    query<{ symbol: string; price: string; recorded_at: string }>(
      "SELECT symbol, price, recorded_at FROM price_ticks WHERE recorded_at > now() - interval '3 days' ORDER BY recorded_at ASC LIMIT 5000"
    ),
  ]);

  const equity = dedupeBySecond(snapshots.map((s) => ({ ts: s.snapshot_at, value: Number(s.equity) })));

  const symbols: Record<string, Point[]> = {};
  for (const sym of Object.keys(WATCHLIST)) symbols[sym] = [];
  for (const row of priceRows) {
    if (!symbols[row.symbol]) symbols[row.symbol] = [];
    const t = Math.floor(new Date(row.recorded_at).getTime() / 1000);
    const arr = symbols[row.symbol];
    const last = arr[arr.length - 1];
    if (last && last.time === t) {
      last.value = Number(row.price);
    } else if (!last || t > last.time) {
      arr.push({ time: t, value: Number(row.price) });
    }
  }

  return NextResponse.json({ equity, symbols });
}
