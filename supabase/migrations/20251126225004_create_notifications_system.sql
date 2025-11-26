/*
  # Create Notifications System

  ## Overview
  Creates a comprehensive notification system to alert users about important actions
  from their friends, including friend requests, IOU changes, settlements, and forgiveness.

  ## Tables Created

  ### 1. notifications
  Stores notification records for users.
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - User receiving the notification
  - `type` (notification_type enum) - Type of notification
  - `title` (text) - Notification headline
  - `message` (text) - Detailed notification message
  - `related_user_id` (uuid) - User who triggered the notification
  - `related_iou_id` (uuid, optional) - Related IOU if applicable
  - `is_read` (boolean) - Whether user has read the notification
  - `created_at` (timestamptz) - When notification was created

  ## Enums Created

  ### notification_type
  - friend_request: New friend request received
  - iou_received: New IOU sent to you
  - iou_forgiven: Debt forgiven (fully or partially)
  - iou_added: More added to existing IOU
  - iou_settled: Settlement confirmed
  - iou_declined: Your IOU was declined

  ## Security
  - RLS enabled on notifications table
  - Users can only view their own notifications
  - Users can only update their own notifications (mark as read)
  - Related user references ensure notification integrity

  ## Indexes
  - Index on user_id for efficient notification retrieval
  - Index on is_read for filtering unread notifications
  - Index on created_at for chronological ordering
*/

-- Create notification type enum
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'friend_request',
    'iou_received',
    'iou_forgiven',
    'iou_added',
    'iou_settled',
    'iou_declined'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  related_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  related_iou_id uuid REFERENCES ious(id) ON DELETE SET NULL,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
