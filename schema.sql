-- Draft schema for Neon Postgres. Applied later once the Neon connector is active.

CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long','short')),
  entry_price NUMERIC NOT NULL,
  size NUMERIC NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);

CREATE TABLE IF NOT EXISTS ai_decisions (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  needs_research BOOLEAN,
  size_tier SMALLINT,
  needs_human_approval BOOLEAN,
  confidence NUMERIC,
  raw_state JSONB,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fills (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL,
  price NUMERIC NOT NULL,
  size NUMERIC NOT NULL,
  pnl NUMERIC NOT NULL DEFAULT 0,
  filled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance_snapshots (
  id SERIAL PRIMARY KEY,
  equity NUMERIC NOT NULL,
  realized_pnl NUMERIC NOT NULL,
  unrealized_pnl NUMERIC NOT NULL,
  win_rate NUMERIC,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
