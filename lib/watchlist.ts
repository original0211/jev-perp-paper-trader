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
  BNBUSDT: "binancecoin",
  ADAUSDT: "cardano",
  DOTUSDT: "polkadot",
  MATICUSDT: "matic-network",
  TONUSDT: "the-open-network",
  TRXUSDT: "tron",
  LTCUSDT: "litecoin",
  BCHUSDT: "bitcoin-cash",
  NEARUSDT: "near",
  APTUSDT: "aptos",
  SUIUSDT: "sui",
  ATOMUSDT: "cosmos",
  OPUSDT: "optimism",
  UNIUSDT: "uniswap",
};
