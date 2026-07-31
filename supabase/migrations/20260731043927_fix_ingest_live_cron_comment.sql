-- The previous migration left a C-style `//` line inside the dollar-quoted job
-- body. That stored fine (it is just text until pg_cron runs it) but would have
-- failed with a syntax error on the first firing. cron.schedule upserts by
-- name, so re-registering it replaces the command in place.
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
        -- pg_net defaults to a 5s timeout, which these runs exceed. The
        -- function completes either way (the request is already in flight),
        -- but a short timeout means the response never lands in
        -- net._http_response, making healthy runs look like failures.
        timeout_milliseconds := 150000
    );
    $$
);
