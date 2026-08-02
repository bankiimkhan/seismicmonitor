# Seismic Monitor

Real-time multi-hazard monitoring (earthquake, cyclone, tsunami, volcano,
wildfire, landslide).

- **Web app** — Next.js 16 App Router on **Cloudflare Workers** via
  [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).
- **Ingest jobs** — Deno **Supabase Edge Functions** on `pg_cron`.
- **Data** — Supabase Postgres.

Both halves run on free tiers. See [Why ingest lives on Supabase](#why-ingest-lives-on-supabase).

## Local development

```bash
cp .env.example .env          # fill in Supabase values
npm install
npm run dev                   # http://localhost:3000
```

**All three Supabase values are required**, including
`SUPABASE_SERVICE_ROLE_KEY`. It is not optional for local work: `/api/hazards`,
`/api/trends`, `/api/cyclone-history`, `/api/quake/[id]` and `/api/health` all
read through the service role (those tables have RLS on with no public policy),
so without it every one of them returns 500 and most of the app renders its
error states. Grab it from the Supabase dashboard → Project Settings → API.

`next dev` is the fast path. `next.config.ts` calls
`initOpenNextCloudflareForDev()`, so the bindings declared in `wrangler.jsonc`
resolve here too.

To exercise the real `workerd` runtime — worth doing before any deploy, since
Node and workerd do diverge:

```bash
cp .dev.vars.example .dev.vars
npm run preview               # builds via the adapter, serves on wrangler
```

## Deploying the web app

One-time setup:

```bash
npx wrangler login
npx wrangler r2 bucket create seismicmonitor-cache   # backs the Next data cache
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Then `npm run deploy`.

`NEXT_PUBLIC_*` variables are **inlined at build time**, so they must be present
wherever the build runs — your shell, CI, or Workers Builds → *Build variables
and secrets*. Setting them as Worker vars only is too late to affect the bundle.

## Ingest jobs

| Schedule       | Edge Function            | Does                                          |
| -------------- | ------------------------ | --------------------------------------------- |
| `*/15 * * * *` | `ingest`                 | Live multi-hazard poll, merge, upsert (~10s)   |
| `0 6 * * *`    | `ingest-cyclone-history` | Daily IBTrACS best-track backfill (~16s)       |

Both are scheduled by `pg_cron`, which calls them over HTTP via `pg_net`. The
schema, the extensions, and the two schedules are all in `supabase/migrations/`,
so a fresh project can be rebuilt with `supabase db push` after linking.

Inspect the live schedule with:

```sql
select jobname, schedule, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 10;
select id, status_code, left(content, 200) from net._http_response order by id desc limit 5;
```

`cron.job_run_details` records only whether `pg_net` *queued* the request (it is
async, so those rows complete in ~50ms); the actual Edge Function response lands
in `net._http_response`. Check both when debugging.

Deploy the functions with the Supabase CLI, which uploads straight from disk and
resolves the `../_shared/` imports for you:

```bash
npx supabase login
npx supabase functions deploy ingest --project-ref <ref>
npx supabase functions deploy ingest-cyclone-history --project-ref <ref>
```

Run one by hand (the anon key is enough — see the auth note below):

```bash
curl -X POST "https://<ref>.supabase.co/functions/v1/ingest" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

### Shared code

The adapters and merge engine stay in `lib/`, which is the single source of
truth and keeps its vitest coverage. `supabase/functions/_shared/` is
**generated** from it:

```bash
npm run sync:edge             # regenerate after editing lib/
node scripts/sync-edge-shared.mjs --check   # what CI runs
```

The script rewrites the two things Deno needs — explicit `.ts` import
extensions and `Deno.env.get()` in place of `process.env` — and strips Next's
`next: { revalidate }` fetch option. Edit `lib/`, never
`supabase/functions/_shared/`. CI fails if the two drift.

### Why ingest lives on Supabase

It ran on Vercel Cron, then briefly on Cloudflare Cron Triggers. It cannot run
on Workers **Free**, for two independent reasons:

- **Subrequests are capped at 50 per invocation.** One `ingest` run makes
  several hundred Supabase calls across its batched writes. This is the hard
  blocker — no amount of tuning fits it.
- **Cron CPU is capped at 10 ms.** Nowhere near enough to parse 20K IBTrACS rows.

Supabase Edge Functions have neither cap, and sit next to the database so the
many small writes stop crossing a network boundary. Measured against their
limits before porting: the IBTrACS parse costs ~0.16 s CPU against a 2 s cap and
~25 MB against a 256 MB cap; the ~10 s download is I/O and doesn't count.

The web app itself is comfortably within Workers Free.

### Auth note

The functions deploy with `verify_jwt = true`, which only requires a validly
signed project JWT. `pg_cron` currently passes the **anon** key, held in Vault
as `edge_invoke_key`. That key is already public (it ships in the browser
bundle), so nothing secret is stored — but anyone holding it could trigger an
ingest run. The runs are idempotent upserts, so the cost is wasted invocations
rather than bad data. To harden:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'edge_invoke_key'),
  '<service-role-key>');
```

## Caching

`open-next.config.ts` points Next's incremental cache at R2
(`NEXT_INC_CACHE_R2_BUCKET`). Every route handler is `force-dynamic`, so there
is little ISR surface — but `lib/earthquakes.ts` relies on
`fetch(..., { next: { revalidate } })` to hold a shared 15-minute window over the
USGS and NCS feeds. With no incremental cache configured that hint is silently
dropped and every request re-fetches upstream.

## Scripts

| Script               | Does                                              |
| -------------------- | ------------------------------------------------- |
| `npm run dev`        | Next dev server                                   |
| `npm run preview`    | Adapter build + local `workerd` via wrangler       |
| `npm run deploy`     | Adapter build + deploy to Cloudflare               |
| `npm run upload`     | Adapter build + upload a version without releasing |
| `npm run sync:edge`  | Regenerate `supabase/functions/_shared` from `lib/` |
| `npm run sync:maplibre` | Re-copy maplibre's worker/shared dist into `public/` |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` from bindings     |
| `npm test`           | Vitest                                            |
| `npm run typecheck`  | `tsc --noEmit`                                    |

## Known limitations

- **Landslide has no working source.** NASA EONET's `landslides` category is the
  only feed wired for that hazard type and it publishes nothing — zero events at
  `status=open` and zero over a 365-day window. The section stays in place but
  carries a standing notice (`coverageNotice` in `lib/hazardConfig.ts`) so an
  empty list can't be misread as "no landslides". Fixing this properly means
  adding a different source.
- **FIRMS wildfire hotspots need a key.** Without `NASA_FIRMS_MAP_KEY` on the
  Supabase project, wildfire coverage is EONET incidents only — no per-pixel
  satellite detections. The ingest job logs a warning and skips the source
  rather than retrying a doomed fetch every cycle:
  ```bash
  npx supabase secrets set NASA_FIRMS_MAP_KEY=... --project-ref <ref>
  ```
- **Tsunami is unexercised.** NOAA/NWS issues these rarely, so the path has
  never processed a live alert. Source health is now recorded on every
  successful fetch (not only when an alert exists), so `/about` will show the
  adapter's status either way.
- **`lib/rateLimit.ts` is per-isolate.** Every route now goes through it, but
  the counter lives in one isolate's memory, so the effective ceiling is higher
  than `maxRequests` under concurrency. A Durable Object would make it global.
- **Custom analytics events are a no-op.** Cloudflare Web Analytics covers
  pageviews and Web Vitals but has no custom-event API, so `track()` in
  `lib/analytics.ts` currently drops `first_visit` / `return_visit`. The wrapper
  and its call sites are kept deliberately, so adding a provider stays a
  one-file change.
- **`response.json()` is untyped at ~30 call sites** in `lib/` and `hooks/`.
  Harmless today, but they destructure unvalidated JSON directly.
- **i18n ships one locale.** `lib/i18n/` has the provider and dictionary but
  only `en`, and nothing calls `setLocale`. It is scaffolding, not a feature.

## Row limits

PostgREST caps an unbounded `select` at `max-rows` (1000 on Supabase) **without
erroring**, so any route that reduces rows in JS has to account for it:

- `/api/cyclone-history` aggregates in Postgres via the
  `cyclone_storm_summaries` function — 20k+ track points never cross the wire.
- `/api/trends` pages explicitly (`PAGE_SIZE`/`MAX_PAGES`), because its region
  bucket comes from `regionForPoint` and isn't worth duplicating in SQL.
- `/api/hazards` clamps its `limit` to 1000, which is the real ceiling anyway.
