-- felt_reports' anon SELECT policy is `using (true)`, which is correct at the
-- row level (the summary on /quake/[id] is meant to aggregate everyone's
-- reports) but was paired with a table-wide column grant. That exposed
-- `device_id` -- a stable per-browser identifier -- to anyone with the anon
-- key, making it trivial to correlate every report a single device has ever
-- filed. `comment` was likewise readable despite no UI reading it.
--
-- RLS controls which ROWS are visible; column grants control which COLUMNS.
-- This narrows the columns to exactly what components/FeltReportSummary.tsx
-- actually reads.
revoke select, insert, update, delete on public.felt_reports from anon, authenticated;

-- Read: only what the public summary needs (count + mean intensity per quake).
grant select (quake_id, intensity, created_at) on public.felt_reports to anon, authenticated;

-- Write: the form's four fields. device_id stays writable (the
-- unique(quake_id, device_id) constraint is what stops double-submits, and the
-- RLS WITH CHECK validates its length) but is now write-only to the public.
-- supabase-js `.insert()` returns no rows unless `.select()` is chained, so no
-- read grant on device_id is needed for the insert to succeed.
grant insert (quake_id, device_id, intensity, comment) on public.felt_reports to anon, authenticated;
