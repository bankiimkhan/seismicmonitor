-- Historical earthquake store, written only by the ingest cron (service role)
create table if not exists public.earthquakes (
  id text primary key,
  source text not null,
  mag numeric,
  place text,
  time timestamptz not null,
  lat numeric,
  lng numeric,
  depth numeric,
  url text,
  inserted_at timestamptz not null default now()
);
create index if not exists earthquakes_time_idx on public.earthquakes (time desc);
create index if not exists earthquakes_place_idx on public.earthquakes using gin (to_tsvector('simple', coalesce(place, '')));

alter table public.earthquakes enable row level security;
-- No public policies: only the service role (server-side) can read/write this table.

-- One row per source per ingest run, powers scraper-health / fallback visibility
create table if not exists public.scraper_health (
  id bigserial primary key,
  source text not null,
  status text not null,
  checked_at timestamptz not null default now()
);
create index if not exists scraper_health_checked_at_idx on public.scraper_health (checked_at desc);

alter table public.scraper_health enable row level security;
-- No public policies: service role only.

-- Community "did you feel it?" reports, anonymous (device-id based, no auth)
create table if not exists public.felt_reports (
  id uuid primary key default gen_random_uuid(),
  quake_id text not null,
  device_id text not null,
  intensity int not null check (intensity between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (quake_id, device_id)
);
create index if not exists felt_reports_quake_id_idx on public.felt_reports (quake_id);

alter table public.felt_reports enable row level security;

create policy "felt_reports_public_insert"
  on public.felt_reports for insert
  to anon
  with check (
    length(device_id) between 8 and 128
    and length(coalesce(comment, '')) <= 500
  );

create policy "felt_reports_public_select"
  on public.felt_reports for select
  to anon
  using (true);
