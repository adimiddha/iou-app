/*
  # Add Phone Number Search (secure, hashed)

  ## Overview
  Adds optional phone number to profiles for friend search. Phone numbers are stored
  as a hash only; normalized form is optional for user's own display. Search is via
  RPC that returns only id and username (no phone data).

  ## Tables Modified

  ### profiles
  - phone_hash (text, nullable, unique) - SHA-256 hash of normalized phone; indexed for search
  - phone_normalized (text, nullable) - Normalized digits only; for user's own reference
  - phone_search_enabled (boolean, default true) - Whether this profile is findable by phone

  ## Security
  - search_by_phone_hash(phone_hash) is SECURITY INVOKER; only returns rows where
    phone_hash matches and phone_search_enabled = true. Returns only id, username.
  - Application must never select phone_normalized for other users (only for auth.uid() = id).
*/

-- Add phone columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_hash text,
  ADD COLUMN IF NOT EXISTS phone_normalized text,
  ADD COLUMN IF NOT EXISTS phone_search_enabled boolean DEFAULT true;

-- Unique index for lookup by phone hash; partial index for searchable profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_hash ON profiles(phone_hash)
  WHERE phone_hash IS NOT NULL;

-- Secure search: returns only id and username for a matching phone hash
CREATE OR REPLACE FUNCTION public.search_by_phone_hash(phone_hash_input text)
RETURNS TABLE(id uuid, username text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.id, p.username
  FROM profiles p
  WHERE p.phone_hash = phone_hash_input
    AND (p.phone_search_enabled IS NULL OR p.phone_search_enabled = true)
  LIMIT 1;
$$;

-- Allow authenticated users to call search
GRANT EXECUTE ON FUNCTION public.search_by_phone_hash(text) TO authenticated;

COMMENT ON COLUMN profiles.phone_hash IS 'SHA-256 hash of normalized phone; used for search only';
COMMENT ON COLUMN profiles.phone_normalized IS 'Normalized phone (digits only); only for own profile display';
COMMENT ON COLUMN profiles.phone_search_enabled IS 'If true, profile can be found by phone number search';
