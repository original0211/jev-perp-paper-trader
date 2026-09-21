import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/history?coin=bitcoin&days=90 — read-only proxy to CoinGecko's public
// market_chart endpoint. Used only for offline backtesting of the momentum heuristic
// (lib/momentum.ts) parameters; not used by the live /api/tick path.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get("coin") ?? "bitcoin";
  const days = searchParams.get("days") ?? "90";

  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
