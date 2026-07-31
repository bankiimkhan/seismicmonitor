create table cyclone_tracks (
  id           text primary key,
  sid          text not null,
  season       int not null,
  basin        text not null,
  subbasin     text,
  name         text not null,
  iso_time     timestamptz not null,
  nature       text,
  lat          double precision not null,
  lng          double precision not null,
  wind_kt      double precision,
  pressure_mb  double precision,
  category     int,
  inserted_at  timestamptz not null default now()
);
create index cyclone_tracks_sid_idx on cyclone_tracks (sid, iso_time);
create index cyclone_tracks_season_basin_idx on cyclone_tracks (season, basin);
alter table cyclone_tracks enable row level security;
