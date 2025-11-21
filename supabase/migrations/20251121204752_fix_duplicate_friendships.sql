/*
  # Fix Duplicate Friendships

  ## Overview
  Prevents duplicate friendships in both directions and cleans up existing duplicates.
  Ensures that if A→B friendship exists, B→A cannot be created.

  ## Changes

  ### 1. Add Bidirectional Unique Constraint
  - Creates a function to normalize friendship pairs (always stores lower UUID first)
  - Adds a unique index that prevents duplicates in both directions
  - Ensures one friendship record per pair of users regardless of direction

  ### 2. Clean Up Existing Duplicates
  - Identifies and removes duplicate friendship records
  - Keeps the oldest friendship record for each unique pair
  - Preserves accepted friendships over pending ones

  ## Security
  - Maintains existing RLS policies
  - No changes to access control

  ## Important Notes
  1. Existing duplicate friendships will be deleted
  2. Only one friendship record per user pair will remain
  3. The constraint applies to all future friendship inserts
*/

-- Create a function to generate a normalized friendship key
-- This ensures friendships A→B and B→A are treated as the same pair
CREATE OR REPLACE FUNCTION friendship_pair_key(user1 uuid, user2 uuid)
RETURNS text AS $$
BEGIN
  IF user1 < user2 THEN
    RETURN user1::text || '-' || user2::text;
  ELSE
    RETURN user2::text || '-' || user1::text;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add a computed column for the normalized pair key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'friendships' AND column_name = 'pair_key'
  ) THEN
    ALTER TABLE friendships 
    ADD COLUMN pair_key text GENERATED ALWAYS AS (friendship_pair_key(requester_id, addressee_id)) STORED;
  END IF;
END $$;

-- Delete duplicate friendships, keeping only one per pair
-- Priority: accepted > pending, older > newer
DELETE FROM friendships
WHERE id IN (
  SELECT f1.id
  FROM friendships f1
  INNER JOIN friendships f2 ON f1.pair_key = f2.pair_key AND f1.id != f2.id
  WHERE 
    -- Keep the accepted one if statuses differ
    (f1.status = 'pending' AND f2.status = 'accepted') OR
    -- If both have same status, keep the older one
    (f1.status = f2.status AND f1.created_at > f2.created_at)
);

-- Create unique constraint on the pair_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_unique_pair 
ON friendships(pair_key);

-- Drop the old unique constraint on (requester_id, addressee_id)
-- since it doesn't prevent bidirectional duplicates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'friendships_requester_id_addressee_id_key'
  ) THEN
    ALTER TABLE friendships DROP CONSTRAINT friendships_requester_id_addressee_id_key;
  END IF;
END $$;
