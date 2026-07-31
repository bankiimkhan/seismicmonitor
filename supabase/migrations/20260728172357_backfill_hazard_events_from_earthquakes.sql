insert into hazard_events (id, hazard_type, place, url, canonical_time, lat, lng, depth_km, magnitude, confidence_tier, status, first_seen_at, last_updated_at)
select id, 'earthquake', place, url, time, lat, lng, depth, mag, 'medium', 'active', inserted_at, inserted_at
from earthquakes;

insert into event_sources (hazard_event_id, agency, agency_native_id, reported_time, reported_lat, reported_lng, reported_depth_km, reported_magnitude, is_canonical, raw_payload, retrieved_at)
select id, source, id, time, lat, lng, depth, mag, true, '{}'::jsonb, inserted_at
from earthquakes;
