create table hazard_events (
  id                text primary key,
  hazard_type       text not null default 'earthquake',
  place             text,
  url               text,
  canonical_time    timestamptz not null,
  lat               double precision not null,
  lng               double precision not null,
  depth_km          double precision,
  magnitude         double precision,
  alert_level       text,
  confidence_tier   text not null default 'medium',
  region_id         text,
  status            text not null default 'active',
  first_seen_at     timestamptz not null default now(),
  last_updated_at   timestamptz not null default now()
);
create index hazard_events_type_time_idx on hazard_events (hazard_type, canonical_time desc);

create table event_sources (
  id                 uuid primary key default gen_random_uuid(),
  hazard_event_id    text not null references hazard_events(id) on delete cascade,
  agency             text not null,
  agency_native_id   text not null,
  reported_time      timestamptz not null,
  reported_lat       double precision,
  reported_lng       double precision,
  reported_depth_km  double precision,
  reported_magnitude double precision,
  is_canonical       boolean not null default false,
  raw_payload        jsonb not null,
  retrieved_at       timestamptz not null default now(),
  unique (agency, agency_native_id)
);

create table event_revisions (
  id                 uuid primary key default gen_random_uuid(),
  hazard_event_id    text not null references hazard_events(id) on delete cascade,
  changed_at         timestamptz not null default now(),
  field              text not null,
  old_value          text,
  new_value          text,
  changed_by_source  text
);

alter table scraper_health
  add column hazard_type text not null default 'earthquake',
  add column last_success_at timestamptz,
  add column consecutive_failures int not null default 0;

alter table hazard_events enable row level security;
alter table event_sources enable row level security;
alter table event_revisions enable row level security;
