/*
  # Fix Missing Index and Function Security

  ## Overview
  Adds missing foreign key index and fixes function security to improve query performance
  and prevent search path vulnerabilities.

  ## Changes

  ### 1. Add Missing Foreign Key Index
  - Add index on `ious.requester_user_id` foreign key column
  - This index was previously removed but is needed for optimal query performance
  - Improves join performance when querying IOUs by requester

  ### 2. Fix Function Security
  - Update `friendship_pair_key` function with SECURITY DEFINER and explicit search_path
  - Prevents search_path manipulation vulnerabilities
  - Maintains IMMUTABLE property for use in generated columns

  ## Performance Benefits
  - Foreign key indexes prevent full table scans on joins
  - SECURITY DEFINER protects against search path attacks
  - Maintains existing functionality with better security

  ## Important Notes
  1. The index on requester_user_id improves query performance for IOU lookups
  2. Function security fixes prevent potential privilege escalation
  3. All changes are backward compatible
*/

-- Add index on requester_user_id foreign key
CREATE INDEX IF NOT EXISTS idx_ious_requester_user_id ON ious(requester_user_id);

-- Fix friendship_pair_key function security
CREATE OR REPLACE FUNCTION friendship_pair_key(user1 uuid, user2 uuid)
RETURNS text
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF user1 < user2 THEN
    RETURN user1::text || '-' || user2::text;
  ELSE
    RETURN user2::text || '-' || user1::text;
  END IF;
END;
$$;
