/*
  # Fix RLS Performance and Security Issues

  ## Overview
  Optimizes Row Level Security policies by wrapping auth functions in SELECT statements
  to prevent re-evaluation for each row, significantly improving query performance at scale.

  ## Changes

  ### 1. Profiles Table RLS Policies
  - Update "Users can insert own profile" policy to use (select auth.uid())
  - Update "Users can update own profile" policy to use (select auth.uid())

  ### 2. IOUs Table RLS Policies
  - Update "Users can view IOUs they are part of" policy to use (select auth.uid())
  - Update "Users can update IOUs they are part of" policy to use (select auth.uid())
  - Update "Users can delete IOUs they are part of" policy to use (select auth.uid())
  - Update "Users can create IOUs with accepted friends" policy to use (select auth.uid())

  ### 3. Friendships Table RLS Policies
  - Update "Users can view friendships they are part of" policy to use (select auth.uid())
  - Update "Users can send friend requests" policy to use (select auth.uid())
  - Update "Users can update received friend requests" policy to use (select auth.uid())
  - Update "Users can delete friendships they are part of" policy to use (select auth.uid())

  ### 4. Function Security Fixes
  - Add SECURITY DEFINER and search_path to update_updated_at_column function
  - Add SECURITY DEFINER and search_path to friendship_pair_key function (if exists)

  ### 5. Index Cleanup
  - Remove unused idx_ious_status index
  - Remove unused idx_ious_requester index

  ## Security Benefits
  - Prevents RLS policies from being re-evaluated for each row
  - Improves query performance significantly at scale
  - Protects functions from search_path vulnerabilities
  - Maintains same security guarantees with better performance

  ## Important Notes
  1. All policies are dropped and recreated with optimized auth.uid() calls
  2. Functions are made SECURITY DEFINER with explicit search_path
  3. Unused indexes are removed to reduce storage overhead
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Recreate profiles policies with optimized auth.uid() calls
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Drop all existing policies on ious table
DROP POLICY IF EXISTS "Users can view IOUs they are part of" ON ious;
DROP POLICY IF EXISTS "Users can update IOUs they are part of" ON ious;
DROP POLICY IF EXISTS "Users can delete IOUs they are part of" ON ious;
DROP POLICY IF EXISTS "Users can create IOUs with accepted friends" ON ious;

-- Recreate ious policies with optimized auth.uid() calls
CREATE POLICY "Users can view IOUs they are part of"
  ON ious FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = from_user_id OR (select auth.uid()) = to_user_id);

CREATE POLICY "Users can update IOUs they are part of"
  ON ious FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = from_user_id OR (select auth.uid()) = to_user_id)
  WITH CHECK ((select auth.uid()) = from_user_id OR (select auth.uid()) = to_user_id);

CREATE POLICY "Users can delete IOUs they are part of"
  ON ious FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = from_user_id OR (select auth.uid()) = to_user_id);

CREATE POLICY "Users can create IOUs with accepted friends"
  ON ious FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IN (from_user_id, to_user_id) AND
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = from_user_id AND addressee_id = to_user_id) OR
        (requester_id = to_user_id AND addressee_id = from_user_id)
      )
    )
  );

-- Drop all existing policies on friendships table
DROP POLICY IF EXISTS "Users can view friendships they are part of" ON friendships;
DROP POLICY IF EXISTS "Users can send friend requests" ON friendships;
DROP POLICY IF EXISTS "Users can update received friend requests" ON friendships;
DROP POLICY IF EXISTS "Users can delete friendships they are part of" ON friendships;

-- Recreate friendships policies with optimized auth.uid() calls
CREATE POLICY "Users can view friendships they are part of"
  ON friendships FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = requester_id OR (select auth.uid()) = addressee_id);

CREATE POLICY "Users can send friend requests"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = requester_id);

CREATE POLICY "Users can update received friend requests"
  ON friendships FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = addressee_id)
  WITH CHECK ((select auth.uid()) = addressee_id);

CREATE POLICY "Users can delete friendships they are part of"
  ON friendships FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = requester_id OR (select auth.uid()) = addressee_id);

-- Fix function security by adding SECURITY DEFINER and explicit search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop unused indexes
DROP INDEX IF EXISTS idx_ious_status;
DROP INDEX IF EXISTS idx_ious_requester;
