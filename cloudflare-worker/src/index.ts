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
  // testing the CRON_SECRET without waiting for the schedule. Safe to remove
  // if you don't want an HTTP-triggerable version of this Worker.
  async fetch(_request: Request, env: Env): Promise<Response> {
    try {
      const res = await callTick(env);
      const body = await res.text();
      return new Response(`Tick triggered manually. Upstream status: ${res.status}\n\n${body}`, {
        status: 200,
      });
    } catch (err) {
      return new Response(`Failed to call upstream: ${(err as Error).message}`, { status: 502 });
    }
  },
};
