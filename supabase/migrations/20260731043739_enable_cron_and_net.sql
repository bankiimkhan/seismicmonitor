-- Scheduling for the two ingest jobs, which moved here from Cloudflare Workers
-- Cron Triggers (Workers Free caps subrequests at 50/invocation and cron CPU at
-- 10ms; the ingest run needs several hundred Supabase calls).
--
-- pg_cron fires the schedule inside Postgres; pg_net makes the outbound HTTP
-- call to the Edge Function without blocking the cron worker.
create extension if not exists pg_cron;
create extension if not exists pg_net;
