-- Run this in Supabase Dashboard → SQL Editor to verify the avatar migration applied.
-- Expected: no errors, and the SELECTs return the expected rows.

-- 1. profiles should have avatar_url column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url';
-- Expected: 1 row (avatar_url, text, YES)

-- 2. avatars bucket should exist
SELECT id, name, public FROM storage.buckets WHERE id = 'avatars';
-- Expected: 1 row (avatars, avatars, true)

-- 3. storage.objects policies for avatars should exist
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname IN (
    'Avatar images are viewable by authenticated users',
    'Users can upload own avatar',
    'Users can update own avatar',
    'Users can delete own avatar'
  )
ORDER BY policyname;
-- Expected: 4 rows (SELECT, INSERT, UPDATE, DELETE)
