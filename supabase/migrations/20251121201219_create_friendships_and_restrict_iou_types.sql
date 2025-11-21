/*
  # Add Friendships System and Restrict IOU Types

  ## Overview
  Implements a friend request system and restricts IOU descriptions to predefined types.
  Users must be accepted friends before they can create IOUs with each other.

  ## Changes

  ### 1. New Table: friendships
  Tracks friend relationships between users with request/acceptance workflow.
  - `id` (uuid, primary key) - Unique identifier for each friendship
  - `requester_id` (uuid) - User who initiated the friend request
  - `addressee_id` (uuid) - User who received the friend request
  - `status` (text) - Request status: 'pending', 'accepted', 'rejected'
  - `created_at` (timestamptz) - When the request was created
  - `updated_at` (timestamptz) - Last status change timestamp

  ### 2. Modified Table: ious
  - Migrates existing data to capitalize first letter of description
  - Adds check constraint to limit description field to specific values
  - Allowed values: 'Coffee', 'Beer', 'Meal', 'Walk', 'Ride'

  ## Security

  ### Row Level Security Policies (friendships)
  - Users can view friendships where they are requester or addressee
  - Users can create friend requests where they are the requester
  - Users can update friend requests where they are the addressee (to accept/reject)
  - Users can delete friend requests where they are involved

  ### Updated RLS Policies (ious)
  - IOUs can only be created between users who are accepted friends

  ## Important Notes
  1. Existing IOU descriptions are automatically migrated to proper case
  2. Friendship status must be 'accepted' for users to create IOUs
  3. Unique constraint prevents duplicate friend requests
  4. Check constraint on friendships prevents self-friending
  5. IOU description is now restricted to five predefined values
  6. Indexes added for efficient friendship queries
*/

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (requester_id != addressee_id),
  UNIQUE(requester_id, addressee_id)
);

-- Migrate existing IOU descriptions to proper case
UPDATE ious SET description = 'Coffee' WHERE LOWER(description) = 'coffee';
UPDATE ious SET description = 'Beer' WHERE LOWER(description) = 'beer';
UPDATE ious SET description = 'Meal' WHERE LOWER(description) IN ('meal', 'lunch', 'dinner', 'breakfast');
UPDATE ious SET description = 'Walk' WHERE LOWER(description) = 'walk';
UPDATE ious SET description = 'Ride' WHERE LOWER(description) = 'ride';

-- Add check constraint to ious table for restricted description values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ious' AND constraint_name = 'ious_description_check'
  ) THEN
    ALTER TABLE ious ADD CONSTRAINT ious_description_check 
      CHECK (description IN ('Coffee', 'Beer', 'Meal', 'Walk', 'Ride'));
  END IF;
END $$;

-- Enable RLS on friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Friendships policies
CREATE POLICY "Users can view friendships they are part of"
  ON friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can send friend requests"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update received friend requests"
  ON friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

CREATE POLICY "Users can delete friendships they are part of"
  ON friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Drop and recreate IOU insert policy to check friendship status
DROP POLICY IF EXISTS "Users can create IOUs where they are involved" ON ious;

CREATE POLICY "Users can create IOUs with accepted friends"
  ON ious FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (from_user_id, to_user_id) AND
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = from_user_id AND addressee_id = to_user_id) OR
        (requester_id = to_user_id AND addressee_id = from_user_id)
      )
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- Apply updated_at trigger to friendships table
DROP TRIGGER IF EXISTS update_friendships_updated_at ON friendships;
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();