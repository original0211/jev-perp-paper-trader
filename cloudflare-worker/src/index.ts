export interface Env {
  CRON_SECRET: string;
  TARGET_URL?: string;
}

const DEFAULT_TARGET_URL = "https://jev-perp-paper-trader.vercel.app/api/tick";

async function callTick(env: Env): Promise<Response> {
  const url = env.TARGET_URL || DEFAULT_TARGET_URL;
  return fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
}

export default {
  // Fires on the Cron Trigger schedule defined in wrangler.toml.
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          const res = await callTick(env);
          console.log(`[jev-tick-trigger] upstream responded ${res.status}`);
        } catch (err) {
          console.error(`[jev-tick-trigger] fetch failed: ${(err as Error).message}`);
        }
      })()
    );
  },

  // Lets you trigger a tick manually by visiting the Worker's URL — useful for
  // testing the CRON_SECRET without waiting for the schedule. TEMP: includes a
  // debug line showing the length/first+last char of CRON_SECRET as loaded by
  // this Worker (never the full value) to diagnose 401 mismatches. Remove once
  // fixed.
  async fetch(_request: Request, env: Env): Promise<Response> {
    const raw = env.CRON_SECRET ?? "";
    const debugInfo = `[debug] CRON_SECRET as seen by this Worker: length=${raw.length}, first=${raw[0] ?? "∅"}, last=${raw[raw.length - 1] ?? "∅"}, hasLeadingSpace=${raw !== raw.trimStart()}, hasTrailingSpace=${raw !== raw.trimEnd()}`;
    try {
      const res = await callTick(env);
      const body = await res.text();
      return new Response(`Tick triggered manually. Upstream status: ${res.status}\n${debugInfo}\n\n${body}`, {
        status: 200,
      });
    } catch (err) {
      return new Response(`Failed to call upstream: ${(err as Error).message}\n${debugInfo}`, { status: 502 });
    }
  },
};
