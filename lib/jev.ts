import { TypeSafeClient, choice, noul, score } from "@typesafe-ai/sdk";

// Jev is a router, not a forecaster. It never predicts market direction.
// All instructions/criteria live here, not in field names (Jev cannot see field names).

export interface MarketState extends Record<string, unknown> {
  market_question: string;
  mark_price?: number;
  your_position: Record<string, unknown>;
  hours_to_resolution?: number;
  research_note?: string;
}

export function buildState(market: any, book: any, position: any, researchNote: string | null = null): MarketState {
  return {
    market_question: market.question,
    mark_price: book.markPrice,
    your_position: position ?? { size: 0 },
    hours_to_resolution: market.hoursToResolution,
    research_note: researchNote ?? "none yet",
  };
}

export function getClient(): TypeSafeClient {
  return new TypeSafeClient();
}

export async function routeDecision(client: TypeSafeClient, state: MarketState) {
  return client.systemOne({
    state,
    questions: {
      needs_research: noul(
        "Has anything changed (price move, new research_note) since we last looked, that would justify a new research call on this market?"
      ),
      size_tier: score(
        "Given the research note's confidence and hours_to_resolution, how large a simulated position (if any) is warranted.",
        ["no position", "small", "medium", "max"]
      ),
      needs_human_approval: noul(
        "Does placing this simulated order require a human to confirm before it is logged, given our policy? Default true unless size_tier is 0 or 1."
      ),
    },
  });
}
