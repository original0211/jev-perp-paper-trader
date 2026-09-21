import { Pool } from "pg";

// Reuse a single pool across invocations (important in serverless/dev hot-reload).
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
  });

if (!globalForPg.pgPool) {
  globalForPg.pgPool = pool;
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  if (!process.env.DATABASE_URL) {
    // No DB configured (e.g. local dev without env) — return empty rather than throwing.
    return [];
  }
  const result = await pool.query(text, params);
  return result.rows as T[];
}
