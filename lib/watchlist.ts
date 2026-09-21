// Central symbol list. CoinGecko ids on the right are used for price lookups.
// Add/remove symbols here only — app/api/tick, app/api/chart-data, and the
// dashboard all read from this single source of truth.
export const WATCHLIST: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  AVAXUSDT: "avalanche-2",
  SOLUSDT: "solana",
  XRPUSDT: "ripple",
  DOGEUSDT: "dogecoin",
  LINKUSDT: "chainlink",
  ARBUSDT: "arbitrum",
};
