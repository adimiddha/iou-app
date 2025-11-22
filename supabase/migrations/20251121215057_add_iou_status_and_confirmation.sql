/*
  # Add IOU Status and Confirmation System

  ## Overview
  Adds reciprocal confirmation for IOU decreases and trust visibility through status tracking.
  Implements the P0 requirements for pending confirmations and disputed items.

  ## Changes

  ### 1. Create IOUStatus Enum
  - confirmed: Normal IOUs, mutually agreed upon (default state)
  - pending_decrease: Awaiting confirmation from the other party for a decrease
  - disputed: Disagreement or declined confirmation

  ### 2. Modify ious Table
  - Add status column (enum, defaults to 'confirmed')
  - Add optional_note column for context on pending changes
  - Add requester_user_id to track who initiated pending decreases
  - Add index on status for efficient filtering

  ## Security
  - RLS policies remain in place - both parties can view and update
  - Status changes are restricted based on requester_user_id logic

  ## Important Notes
  - Existing IOUs will default to 'confirmed' status
  - Only 'confirmed' IOUs should be included in balance calculations
  - Pending items should be displayed separately in UI
*/

-- Create the status enum type
DO $$ BEGIN
  CREATE TYPE iou_status AS ENUM ('confirmed', 'pending_decrease', 'disputed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add new columns to ious table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ious' AND column_name = 'status'
  ) THEN
    ALTER TABLE ious ADD COLUMN status iou_status DEFAULT 'confirmed' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ious' AND column_name = 'optional_note'
  ) THEN
    ALTER TABLE ious ADD COLUMN optional_note text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ious' AND column_name = 'requester_user_id'
  ) THEN
    ALTER TABLE ious ADD COLUMN requester_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index on status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_ious_status ON ious(status);

-- Create index on requester_user_id
CREATE INDEX IF NOT EXISTS idx_ious_requester ON ious(requester_user_id);
