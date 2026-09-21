// A simple, deterministic (non-LLM) heuristic that supplies the one thing Jev
// deliberately never provides: a market direction. Jev only says how much size is
// warranted and whether a human needs to approve — it never says long or short.
// This module looks at recent recorded ticks and infers direction from the percent
// change over the lookback window. If the move is too small, no direction is given
// and the caller should NOT open a position, regardless of what Jev's size_tier says.
//
// Parameters below (1% threshold, 3-tick lookback) come from a simple backtest run
// on 90 days of daily BTC/ETH/AVAX prices (see project notes / chat history). That
// backtest used in-sample data only, no train/test split, no fees or slippage, and
// covered a period that included a strong rally — treat these as a documented
// starting point, not a validated trading edge.

export interface Tick {
  price: number;
  recorded_at: string;
}

export interface MomentumResult {
  direction: "long" | "short" | null;
  changePct: number;
  ticksUsed: number;
}

export const MOMENTUM_THRESHOLD = 0.01; // 1% move across the lookback window
export const MOMENTUM_LOOKBACK_TICKS = 3;

export function computeMomentum(ticks: Tick[]): MomentumResult {
  if (ticks.length < 2) {
    return { direction: null, changePct: 0, ticksUsed: ticks.length };
  }
  const sorted = [...ticks].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const oldest = sorted[0].price;
  const latest = sorted[sorted.length - 1].price;
  const changePct = (latest - oldest) / oldest;

  if (changePct > MOMENTUM_THRESHOLD) {
    return { direction: "long", changePct, ticksUsed: sorted.length };
  }
  if (changePct < -MOMENTUM_THRESHOLD) {
    return { direction: "short", changePct, ticksUsed: sorted.length };
  }
  return { direction: null, changePct, ticksUsed: sorted.length };
}
