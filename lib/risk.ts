import fs from "fs";

// All risk limits are enforced in code. The model never sets dollar amounts directly.

export const RISK_LIMITS = {
  MAX_USD_PER_MARKET: 100,
  MAX_USD_PER_DAY: 500,
  MAX_CONCURRENT_POSITIONS: 20,
  SIZE_TIER_USD: { 0: 0, 1: 25, 2: 60, 3: 100 } as Record<number, number>,
  // From the same 90-day backtest as lib/momentum.ts's threshold/lookback. Paired
  // 2% stop-loss / 3% take-profit (1.5:1 reward:risk) was the best-performing
  // combination tested, not a guarantee of future results.
  STOP_LOSS_PCT: 0.02,
  TAKE_PROFIT_PCT: 0.03,
};

export const KILL_SWITCH_PATH = ".KILL_SWITCH";

export function isKilled(): boolean {
  return fs.existsSync(KILL_SWITCH_PATH);
}

export function sizeTierToUsd(tier: number): number {
  const capped = Math.min(tier, 3);
  return RISK_LIMITS.SIZE_TIER_USD[capped] ?? 0;
}
