// Simulation-only matching engine. No real exchange orders are ever sent from this file.

export interface PaperPosition {
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  size: number;
  openedAt: string;
}

export interface PaperFill {
  symbol: string;
  action: "open_long" | "open_short" | "close";
  price: number;
  size: number;
  pnl: number;
  filledAt: string;
}

export function simulateFill(
  symbol: string,
  side: "long" | "short",
  usdSize: number,
  markPrice: number
): { position: PaperPosition; fill: PaperFill } {
  const size = usdSize / markPrice;
  const now = new Date().toISOString();
  return {
    position: { symbol, side, entryPrice: markPrice, size, openedAt: now },
    fill: {
      symbol,
      action: side === "long" ? "open_long" : "open_short",
      price: markPrice,
      size,
      pnl: 0,
      filledAt: now,
    },
  };
}

export function markToMarket(position: PaperPosition, currentPrice: number): number {
  const direction = position.side === "long" ? 1 : -1;
  return direction * (currentPrice - position.entryPrice) * position.size;
}
