-- Replaces the `crons` block that lived in vercel.json and then wrangler.jsonc.
-- pg_cron runs in UTC, matching what those schedules already assumed.
--
-- NOTE: the `ingest-live` job body below contains a stray C-style `//` comment
-- line, which is not valid SQL. It stored fine (the $$...$$ body is just text
-- until pg_cron runs it) but would have failed on the first firing. Kept here
-- as applied -- 20260731043927_fix_ingest_live_cron_comment.sql is the fix.
--
-- The invoke key is kept in Vault rather than inlined into the job command,
-- so swapping it is a one-row update and it does not sit in cron.job in the
-- clear. It is currently the project's *anon* key: Edge Functions are deployed
-- with verify_jwt = true, which only requires a validly signed project JWT, and
-- the functions use the platform-injected service role internally for their own
-- writes. The anon key is already public (it ships in the browser bundle), so
-- this stores nothing secret -- but it does mean anyone holding it could
-- trigger an ingest run. To harden, replace the secret with the service role
-- key:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'edge_invoke_key'),
--     '<service-role-key>');
select vault.create_secret(
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4YXBqeHB1ZnZ6cWVjZW9vcmV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNzI1MzEsImV4cCI6MjEwMDc0ODUzMX0.jGs3houjGITJYybXoBxhofwyiACaMHzZ_LjZaxXcHHo',
    'edge_invoke_key',
    'JWT pg_cron uses to invoke the ingest Edge Functions'
);

-- Live multi-hazard poll. Measured at ~10s wall clock.
select cron.schedule(
    'ingest-live',
    '*/15 * * * *',
    $$
    select net.http_post(
        url := 'https://txapjxpufvzqeceoorey.supabase.co/functions/v1/ingest',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_invoke_key')
        ),
        -- pg_net defaults to 5s, which these runs exceed. The function would
        // still complete either way -- the request is already in flight -- but
        -- a short timeout means the response never lands in net._http_response,
        -- so runs would look like failures when inspecting history.
        timeout_milliseconds := 150000
    );
    $$
);

-- Daily IBTrACS best-track backfill. Measured at ~16s wall clock.
select cron.schedule(
    'ingest-cyclone-history',
    '0 6 * * *',
    $$
    select net.http_post(
        url := 'https://txapjxpufvzqeceoorey.supabase.co/functions/v1/ingest-cyclone-history',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_invoke_key')
        ),
        timeout_milliseconds := 150000
    );
    $$
);
