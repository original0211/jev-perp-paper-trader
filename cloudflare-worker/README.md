# jev-tick-trigger (Cloudflare Worker)

A minimal, standalone Cloudflare Worker that replaces the GitHub Actions
workaround for triggering `/api/tick` at higher frequency than Vercel's
Hobby-plan Cron (1x/day). The Next.js app itself stays on Vercel — this
Worker only calls it on a schedule.

## Why this exists

Vercel Cron on the Hobby plan is limited to once per day. Cloudflare
Workers Cron Triggers support down to a 1-minute interval on the **free**
plan (up to 3 triggers per Worker). This Worker's only job is to `fetch`
your existing `/api/tick` endpoint on that schedule with the right
`Authorization: Bearer <CRON_SECRET>` header.

## Deploy steps (manual — do this in the Cloudflare dashboard or CLI)

1. Install dependencies locally:
   ```
   cd cloudflare-worker
   npm install
   ```
2. Log in to Cloudflare (opens a browser):
   ```
   npx wrangler login
   ```
3. Set the secret so it matches the `CRON_SECRET` env var already configured
   on the Vercel project (Vercel Dashboard > Settings > Environment Variables):
   ```
   npx wrangler secret put CRON_SECRET
   ```
   Paste the exact same value — no extra whitespace/newline.
4. Deploy:
   ```
   npx wrangler deploy
   ```
5. Confirm the Cron Trigger is active: Cloudflare Dashboard > Workers & Pages >
   `jev-tick-trigger` > Triggers tab. You should see the cron schedule from
   `wrangler.toml` listed there.
6. (Optional) Test immediately without waiting for the schedule by visiting
   the Worker's `*.workers.dev` URL in a browser — the `fetch` handler calls
   `/api/tick` on demand and shows you the upstream status code.

## After deploying

Once this Worker is live and firing successfully (check Cloudflare Dashboard
> Workers & Pages > jev-tick-trigger > Logs, or just watch Neon's `price_ticks`
table for new rows), you can safely delete `.github/workflows/tick.yml` from
the main repo — it's now redundant. `vercel.json`'s once-daily Cron can stay
as a low-cost fallback if this Worker ever has an outage.

## Adjusting frequency

Edit the `crons` array in `wrangler.toml`. Every symbol in `lib/watchlist.ts`
gets its own Jev API call per tick, so going more frequent multiplies Jev API
usage by the number of symbols (currently 22). Start conservative and tighten
the interval once you've confirmed the cost/latency is acceptable.
