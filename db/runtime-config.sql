-- ──────────────────────────────────────────────────────────────────
-- SPLIT PULSE — Runtime config (Realtime, Storage)
-- Idempotent. Run AFTER schema + rls + seed.
-- ──────────────────────────────────────────────────────────────────

-- 1. REALTIME ------------------------------------------------------
-- Add tables to the supabase_realtime publication so client subscriptions fire.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'instants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE instants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE locations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'instant_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE instant_reactions;
  END IF;
END $$;

-- 2. STORAGE BUCKET -----------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instant-photos',
  'instant-photos',
  true,
  5 * 1024 * 1024,
  ARRAY['image/jpeg','image/png','image/webp','image/heic']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. STORAGE POLICIES ---------------------------------------------
-- Public read: anyone can GET instant-photos files (URLs are unguessable so this is fine).
DROP POLICY IF EXISTS "Public read instant photos" ON storage.objects;
CREATE POLICY "Public read instant photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'instant-photos');

-- Authenticated upload: any signed-in (incl. anonymous) user can upload to their own folder.
DROP POLICY IF EXISTS "Authenticated upload instant photos" ON storage.objects;
CREATE POLICY "Authenticated upload instant photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'instant-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. VERIFY --------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('instants','locations','instant_reactions')) AS realtime_tables,
  (SELECT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'instant-photos')) AS bucket_exists;
