-- ──────────────────────────────────────────────────────────────────
-- SPLIT PULSE — Seed
-- Real GPS-anchored objects (coordinates from Google Maps).
-- Run AFTER schema.sql and rls.sql.
-- Idempotent on slug via INSERT … ON CONFLICT.
-- ──────────────────────────────────────────────────────────────────

-- 1. TECHNOLOGICAL PARK --------------------------------------------
-- GPS coords from OpenStreetMap Nominatim (authoritative).

INSERT INTO locations
  (name, slug, type, tags, center, radius_meters, is_event_zone, event_name)
VALUES
  ('Tehnoloski park', 'tech-park', 'venue',
   ARRAY['tech','hackathon','events'],
   ST_SetSRID(ST_MakePoint(16.4975672, 43.5255286), 4326)::geography, 300, true,
   'SheepAI hakaton')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  center = EXCLUDED.center;

-- 2. TOP 10 ICONIC SPLIT LOCATIONS (real GPS from OSM Nominatim) ---

INSERT INTO locations (name, slug, type, tags, center, radius_meters) VALUES
  ('Riva',                  'riva',               'area',     ARRAY['walk','coffee','tourists','promenade'],     ST_SetSRID(ST_MakePoint(16.4381723, 43.5077974), 4326)::geography, 350),
  ('Dioklecijanova palača', 'diocletians-palace', 'landmark', ARRAY['culture','tourism','unesco','history'],     ST_SetSRID(ST_MakePoint(16.4402486, 43.5085048), 4326)::geography, 200),
  ('Peristil',              'peristil',           'landmark', ARRAY['sightseeing','events','history'],           ST_SetSRID(ST_MakePoint(16.4401693, 43.5082394), 4326)::geography,  50),
  ('Pjaca',                 'pjaca',              'area',     ARRAY['coffee','food','social','square'],          ST_SetSRID(ST_MakePoint(16.4384651, 43.5088844), 4326)::geography,  80),
  ('Prokurative',           'prokurative',        'venue',    ARRAY['concerts','public-events','square'],        ST_SetSRID(ST_MakePoint(16.4363929, 43.5089929), 4326)::geography, 120),
  ('Matejuška',             'matejuska',          'area',     ARRAY['sunset','local','drinks','harbor'],         ST_SetSRID(ST_MakePoint(16.4347135, 43.5073058), 4326)::geography, 100),
  ('Marjan',                'marjan',             'area',     ARRAY['nature','sport','viewpoints','park'],       ST_SetSRID(ST_MakePoint(16.4093040, 43.5085563), 4326)::geography, 800),
  ('Bačvice',               'bacvice',            'beach',    ARRAY['beach','nightlife','sport','picigin'],      ST_SetSRID(ST_MakePoint(16.4459785, 43.5019374), 4326)::geography, 200),
  ('Žnjan',                 'znjan',              'beach',    ARRAY['beach','recreation','family'],              ST_SetSRID(ST_MakePoint(16.4799438, 43.5019635), 4326)::geography, 300),
  ('Poljud',                'poljud',             'venue',    ARRAY['sports','concerts','stadium','hajduk'],     ST_SetSRID(ST_MakePoint(16.4319187, 43.5195411), 4326)::geography, 200)
ON CONFLICT (slug) DO UPDATE SET center = EXCLUDED.center;

-- 3. INITIAL PULSE CALCULATION -------------------------------------

SELECT calculate_pulse_score(id) FROM locations;

-- 3. SANITY CHECK --------------------------------------------------
DO $$
DECLARE
  loc_count INT;
  inst_count INT;
BEGIN
  SELECT count(*) INTO loc_count  FROM locations;
  SELECT count(*) INTO inst_count FROM active_instants;
  RAISE NOTICE 'Seed complete: % locations, % active instants', loc_count, inst_count;
END $$;
