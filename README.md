# Jev Perp Paper Trader

Simulation-only crypto perpetuals paper-trading dashboard, routed through **Jev** (TypeSafe AI's System One model). No real orders are ever placed — this project is for architecture/strategy testing only.

## Architecture

```
Exchange market data (read-only)
        |
        v
lib/jev.ts  --  Jev asks: needs_research? size_tier? needs_human_approval?
        |
        v
lib/risk.ts  --  hard-coded limits: max $/market, max $/day, max concurrent positions, kill switch
        |
        v
lib/paper-engine.ts  --  simulates fills against live prices, tracks virtual PnL
        |
        v
Postgres (Neon)  --  positions, ai_decisions, fills, performance_snapshots
        |
        v
app/  --  Next.js dashboard (equity curve, positions, AI decision log, fills, performance)
```

## Design principles

- Jev never decides market direction. It only classifies, scores confidence, and flags when a human should approve.
- All position sizing tiers map to dollar amounts in code, not in model output.
- A `KILL_SWITCH` file, if present, halts all simulated order placement immediately.
- Every Jev decision (state, question, answer, confidence) and every simulated fill is logged for later calibration against real market outcomes.

## Status

Early scaffold. Simulation only. Not connected to any real exchange account or real funds.

## Stack

- Next.js (App Router) + TypeScript
- typesafe-sdk (Jev client)
- Neon (Postgres) for state/logging
- Vercel for hosting
