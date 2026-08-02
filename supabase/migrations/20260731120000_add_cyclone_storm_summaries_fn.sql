-- /api/cyclone-history used to select every cyclone_tracks row and fold it into
-- one summary per storm in the Worker. PostgREST caps an unbounded select at
-- `max-rows` (1000 on Supabase), and the query ordered iso_time *ascending*, so
-- the aggregation only ever saw the OLDEST 1000 of 20,245 points -- 13 storms
-- out of 344, none newer than 2023-03, on a panel titled "Recent Seasons".
--
-- Aggregating here instead removes the cap from the equation entirely (one row
-- per storm comes back, not one per track point) and stops shipping ~20k rows
-- across the network to be reduced in a Worker.
--
-- The per-storm field semantics deliberately match what the JS did, so the
-- response shape is unchanged:
--   name/season/basin -> value at the EARLIEST track point (a storm can change
--                        basin mid-life; the old code took the first row of an
--                        iso_time-ascending scan)
--   peak wind/category -> max across all points, null when never reported
--   first/last time    -> min/max iso_time
create or replace function public.cyclone_storm_summaries(
    p_season int default null,
    p_basin text default null,
    p_limit int default 50
)
returns table (
    sid text,
    name text,
    season int,
    basin text,
    peak_wind_kt double precision,
    peak_category int,
    first_time timestamptz,
    last_time timestamptz
)
language sql
stable
set search_path = public
as $$
    select
        t.sid,
        (array_agg(t.name order by t.iso_time))[1] as name,
        (array_agg(t.season order by t.iso_time))[1] as season,
        (array_agg(t.basin order by t.iso_time))[1] as basin,
        max(t.wind_kt) as peak_wind_kt,
        max(t.category) as peak_category,
        min(t.iso_time) as first_time,
        max(t.iso_time) as last_time
    from public.cyclone_tracks t
    where (p_season is null or t.season = p_season)
      and (p_basin is null or t.basin = p_basin)
    group by t.sid
    order by max(t.iso_time) desc
    limit greatest(1, least(200, coalesce(p_limit, 50)));
$$;

-- Read path runs as the service role (cyclone_tracks has RLS on with no
-- policies -- see create_cyclone_tracks_table). No anon grant: this stays
-- server-only, same as every other read in app/api.
revoke all on function public.cyclone_storm_summaries(int, text, int) from public, anon, authenticated;
grant execute on function public.cyclone_storm_summaries(int, text, int) to service_role;
