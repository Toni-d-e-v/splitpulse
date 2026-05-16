-- ──────────────────────────────────────────────────────────────────
-- SPLIT PULSE — Schema
-- Source: SPLIT_PULSE_TECHNICAL_SPEC.md §3, §18
-- Run order: 1) schema.sql  2) rls.sql  3) seed.sql
-- Apply via Supabase Dashboard → SQL Editor (or `supabase db push`).
-- ──────────────────────────────────────────────────────────────────

-- 1. EXTENSIONS ---------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES -------------------------------------------------------

-- profiles: mirrors auth.users 1:1
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pulse_name TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  streak_count INT DEFAULT 0,
  streak_last_date DATE,
  pulse_points INT DEFAULT 0,
  helper_score INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- locations: pre-seeded zones (Tech Park sub-zones + Split locations)
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'zone',
  tags TEXT[] DEFAULT '{}',
  center GEOGRAPHY(POINT, 4326) NOT NULL,
  radius_meters INT DEFAULT 200,
  parent_id UUID REFERENCES locations(id),
  pulse_score INT DEFAULT 0,
  pulse_status TEXT DEFAULT 'quiet',
  is_event_zone BOOLEAN DEFAULT false,
  event_name TEXT,
  event_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_center      ON locations USING GIST(center);
CREATE INDEX IF NOT EXISTS idx_locations_slug        ON locations(slug);
CREATE INDEX IF NOT EXISTS idx_locations_pulse_status ON locations(pulse_status);
CREATE INDEX IF NOT EXISTS idx_locations_parent      ON locations(parent_id);

-- instants: core content table
-- NOTE: default type changed from spec's 'general' to 'text' to match API type union.
CREATE TABLE IF NOT EXISTS instants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  location_id UUID REFERENCES locations(id) NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  image_url TEXT,
  geo GEOGRAPHY(POINT, 4326) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  confirm_count INT DEFAULT 0,
  helpful_count INT DEFAULT 0,
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instants_location ON instants(location_id);
CREATE INDEX IF NOT EXISTS idx_instants_geo      ON instants USING GIST(geo);
CREATE INDEX IF NOT EXISTS idx_instants_expires  ON instants(expires_at);
CREATE INDEX IF NOT EXISTS idx_instants_type     ON instants(type);
CREATE INDEX IF NOT EXISTS idx_instants_created  ON instants(created_at DESC);

-- instant_reactions: confirmations, helpful marks, answers
CREATE TABLE IF NOT EXISTS instant_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instant_id UUID REFERENCES instants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instant_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_reactions_instant ON instant_reactions(instant_id);

-- ai_queries: log of AI summary/ask requests
CREATE TABLE IF NOT EXISTS ai_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  location_id UUID REFERENCES locations(id),
  query TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_queries_location ON ai_queries(location_id);

-- favorite_collections: created BEFORE favorites because favorites references it
CREATE TABLE IF NOT EXISTS favorite_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📍',
  is_public BOOLEAN DEFAULT false,
  share_slug TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collections_user ON favorite_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_slug ON favorite_collections(share_slug);

-- favorites
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE NOT NULL,
  note TEXT,
  collection_id UUID REFERENCES favorite_collections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

-- 3. VIEWS --------------------------------------------------------

-- active_instants includes computed latitude/longitude for easy client use.
CREATE OR REPLACE VIEW active_instants AS
SELECT
  i.*,
  ST_Y(i.geo::geometry) AS latitude,
  ST_X(i.geo::geometry) AS longitude
FROM instants i
WHERE i.expires_at > now()
  AND i.is_resolved = false
ORDER BY i.created_at DESC;

-- locations_view exposes lat/lng as plain columns (UI doesn't deal with PostGIS).
CREATE OR REPLACE VIEW locations_view AS
SELECT
  l.id, l.name, l.slug, l.description, l.type, l.tags,
  ST_Y(l.center::geometry) AS latitude,
  ST_X(l.center::geometry) AS longitude,
  l.radius_meters, l.parent_id,
  l.pulse_score, l.pulse_status,
  l.is_event_zone, l.event_name, l.event_ends_at,
  l.created_at, l.updated_at
FROM locations l;

-- 4. RPC FUNCTIONS ------------------------------------------------

-- Compute pulse score for a location, update locations row, return new score.
CREATE OR REPLACE FUNCTION calculate_pulse_score(loc_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  score INT;
BEGIN
  SELECT
    COALESCE(COUNT(DISTINCT i.user_id), 0)
    + COALESCE(COUNT(i.id) FILTER (WHERE i.created_at > now() - interval '30 min'), 0) * 4
    + COALESCE(SUM(i.confirm_count) FILTER (WHERE i.created_at > now() - interval '30 min'), 0) * 5
    + COALESCE(COUNT(i.id) FILTER (WHERE i.type = 'question' AND i.created_at > now() - interval '30 min'), 0) * 3
    + COALESCE(
        (SELECT COUNT(*)
         FROM instant_reactions r
         JOIN instants i2 ON r.instant_id = i2.id
         WHERE i2.location_id = loc_id
           AND r.type = 'answer'
           AND r.created_at > now() - interval '30 min'), 0) * 4
    + COALESCE(COUNT(i.id) FILTER (
        WHERE i.type = 'question'
          AND i.is_resolved = true
          AND i.created_at > now() - interval '60 min'), 0) * 6
    + COALESCE(
        (SELECT COUNT(*)
         FROM ai_queries q
         WHERE q.location_id = loc_id
           AND q.created_at > now() - interval '30 min'), 0) * 2
  INTO score
  FROM instants i
  WHERE i.location_id = loc_id
    AND i.expires_at > now();

  UPDATE locations SET
    pulse_score = score,
    pulse_status = CASE
      WHEN score >= 100 THEN 'high_pulse'
      WHEN score >= 61  THEN 'trending'
      WHEN score >= 31  THEN 'rising'
      WHEN score >= 11  THEN 'active'
      ELSE 'quiet'
    END,
    updated_at = now()
  WHERE id = loc_id;

  RETURN COALESCE(score, 0);
END;
$$;

-- Find nearest zone for a GPS point (within its radius). Returns NULL if outside all zones.
CREATE OR REPLACE FUNCTION find_nearest_zone(lat FLOAT, lng FLOAT)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM locations
  WHERE ST_DWithin(
    center,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  )
  ORDER BY ST_Distance(
    center,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  )
  LIMIT 1;
$$;

-- Hourly cleanup of fully-expired Instants
CREATE OR REPLACE FUNCTION cleanup_expired_instants()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM instants WHERE expires_at < now() - interval '1 hour';
END;
$$;

-- 5. TRIGGERS -----------------------------------------------------

-- Bootstrap a profiles row whenever a new auth.users row appears.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep instants.confirm_count / helpful_count in sync with instant_reactions
CREATE OR REPLACE FUNCTION public.bump_reaction_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type = 'confirm' THEN
    UPDATE instants SET confirm_count = confirm_count + 1 WHERE id = NEW.instant_id;
  ELSIF NEW.type = 'helpful' THEN
    UPDATE instants SET helpful_count = helpful_count + 1 WHERE id = NEW.instant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_reaction_inserted ON instant_reactions;
CREATE TRIGGER on_reaction_inserted
  AFTER INSERT ON instant_reactions
  FOR EACH ROW EXECUTE FUNCTION public.bump_reaction_counts();
-- ──────────────────────────────────────────────────────────────────
-- SPLIT PULSE — Row Level Security
-- Source: SPLIT_PULSE_TECHNICAL_SPEC.md §12, §18.1
-- Run AFTER schema.sql, BEFORE seed.sql.
-- ──────────────────────────────────────────────────────────────────

-- profiles ----------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read profiles"  ON profiles;
DROP POLICY IF EXISTS "Users update own profile"  ON profiles;

CREATE POLICY "Anyone can read profiles"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- locations ---------------------------------------------------------
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read locations" ON locations;

CREATE POLICY "Anyone can read locations"
  ON locations FOR SELECT USING (true);

-- instants ----------------------------------------------------------
ALTER TABLE instants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active instants"     ON instants;
DROP POLICY IF EXISTS "Authenticated users can create instants" ON instants;
DROP POLICY IF EXISTS "Users can update own instants"       ON instants;

-- Read: anyone (auth or anon) can see still-active Instants.
CREATE POLICY "Anyone can read active instants"
  ON instants FOR SELECT USING (expires_at > now());

-- Create: requires auth (anonymous Supabase sessions DO have auth.uid()).
CREATE POLICY "Authenticated users can create instants"
  ON instants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Update: owner only (e.g. mark resolved).
CREATE POLICY "Users can update own instants"
  ON instants FOR UPDATE USING (auth.uid() = user_id);

-- instant_reactions -------------------------------------------------
ALTER TABLE instant_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read reactions"      ON instant_reactions;
DROP POLICY IF EXISTS "Authenticated users can react"  ON instant_reactions;

CREATE POLICY "Anyone can read reactions"
  ON instant_reactions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can react"
  ON instant_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ai_queries --------------------------------------------------------
ALTER TABLE ai_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read ai_queries"     ON ai_queries;
DROP POLICY IF EXISTS "Authenticated users can log ai_queries" ON ai_queries;

CREATE POLICY "Anyone can read ai_queries"
  ON ai_queries FOR SELECT USING (true);

CREATE POLICY "Authenticated users can log ai_queries"
  ON ai_queries FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR user_id IS NULL);

-- favorites ---------------------------------------------------------
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own favorites"   ON favorites;
DROP POLICY IF EXISTS "Users manage own favorites" ON favorites;

CREATE POLICY "Users read own favorites"
  ON favorites FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users manage own favorites"
  ON favorites FOR ALL USING (auth.uid() = user_id);

-- favorite_collections ----------------------------------------------
ALTER TABLE favorite_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own collections" ON favorite_collections;
DROP POLICY IF EXISTS "Public collections readable" ON favorite_collections;
DROP POLICY IF EXISTS "Users manage own collections" ON favorite_collections;

CREATE POLICY "Users read own collections"
  ON favorite_collections FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Public collections readable"
  ON favorite_collections FOR SELECT USING (is_public = true);

CREATE POLICY "Users manage own collections"
  ON favorite_collections FOR ALL USING (auth.uid() = user_id);
