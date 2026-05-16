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
