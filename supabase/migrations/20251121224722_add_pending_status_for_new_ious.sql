/*
  # Add Pending Status for New IOUs

  ## Overview
  Adds a 'pending' status to support requiring acceptance for all new IOUs.
  This allows both "I Owe" and "Owes Me" IOUs to require confirmation from the other party.

  ## Changes
  
  ### 1. Update IOUStatus Enum
  - Add 'pending' status for new IOUs awaiting acceptance
  - Existing statuses remain: 'confirmed', 'pending_decrease', 'disputed'

  ### 2. Status Meanings
  - pending: New IOU awaiting acceptance by recipient
  - confirmed: Normal IOUs, mutually agreed upon
  - pending_decrease: Awaiting confirmation for a payment/decrease
  - disputed: Disagreement or declined confirmation

  ## Important Notes
  - All new IOUs will be created with 'pending' status
  - Only 'confirmed' IOUs are included in balance calculations
  - Both 'pending' and 'pending_decrease' items should be displayed in pending section
*/

-- Add 'pending' to the iou_status enum
ALTER TYPE iou_status ADD VALUE IF NOT EXISTS 'pending';