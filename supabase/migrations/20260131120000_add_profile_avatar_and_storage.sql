/*
  # Add profile avatar and avatars storage bucket

  ## Overview
  - Add avatar_url to profiles for profile photo.
  - Create avatars storage bucket (public read) with RLS so users can upload only their own avatar.

  ## Changes
  - profiles: add avatar_url text (nullable).
  - storage.buckets: insert avatars bucket if not present (public for read).
  - storage.objects: RLS policies for SELECT (all authenticated), INSERT/UPDATE/DELETE (own folder only).
*/

-- Add avatar URL to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN profiles.avatar_url IS 'Public URL of profile photo in avatars bucket';

-- Create avatars bucket (public so profile photos are viewable by URL).
-- Minimal columns for compatibility; bucket can also be created via Dashboard or JS createBucket().
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS on storage.objects: allow authenticated users to read all avatar objects
CREATE POLICY "Avatar images are viewable by authenticated users"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

-- Allow users to upload only to their own path: avatars/{user_id}/...
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

-- Allow users to update/delete only their own avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );
