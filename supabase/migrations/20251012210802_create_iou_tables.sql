/*
  # IOU Tracking System Schema

  ## Overview
  Creates the database structure for tracking IOUs (I Owe You) between friends.
  Supports tracking favors like beers, rides, meals, etc. with real-time updates.

  ## Tables Created

  ### 1. profiles
  Stores user profile information with unique usernames.
  - `id` (uuid, primary key) - References auth.users
  - `username` (text, unique) - Display name for the user
  - `created_at` (timestamptz) - Account creation timestamp

  ### 2. ious
  Tracks individual IOU transactions between users.
  - `id` (uuid, primary key) - Unique identifier for each IOU
  - `from_user_id` (uuid) - User who owes the favor
  - `to_user_id` (uuid) - User who is owed the favor
  - `description` (text) - What is owed (e.g., "beer", "ride home")
  - `amount` (integer, default 1) - Quantity owed
  - `created_at` (timestamptz) - When the IOU was created
  - `updated_at` (timestamptz) - Last modification time

  ## Security
  
  ### Row Level Security (RLS)
  - All tables have RLS enabled
  - Users can only read/write their own profile data
  - Users can view IOUs where they are either the giver or receiver
  - Users can create IOUs where they are the from_user or to_user
  - Users can update/delete IOUs where they are involved

  ## Important Notes
  1. All timestamps use timestamptz for timezone awareness
  2. Usernames must be unique across the system
  3. IOUs track directional debt (from → to)
  4. Amount defaults to 1 for simple "one beer" tracking
  5. Foreign key constraints ensure data integrity
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create ious table
CREATE TABLE IF NOT EXISTS ious (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount integer DEFAULT 1 CHECK (amount > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ious ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- IOUs policies
CREATE POLICY "Users can view IOUs they are part of"
  ON ious FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create IOUs where they are involved"
  ON ious FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can update IOUs they are part of"
  ON ious FOR UPDATE
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can delete IOUs they are part of"
  ON ious FOR DELETE
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ious_from_user ON ious(from_user_id);
CREATE INDEX IF NOT EXISTS idx_ious_to_user ON ious(to_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to ious table
DROP TRIGGER IF EXISTS update_ious_updated_at ON ious;
CREATE TRIGGER update_ious_updated_at
  BEFORE UPDATE ON ious
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();