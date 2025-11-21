/*
  # Add Pizza to IOU Types

  ## Overview
  Adds 'Pizza' as a valid IOU type to the existing check constraint.

  ## Changes

  ### 1. Update Check Constraint
  - Drops the existing check constraint on ious.description
  - Recreates it with all six types: Coffee, Beer, Meal, Walk, Ride, Pizza

  ## Important Notes
  - This change is backward compatible - existing data remains valid
  - New IOUs can now use 'Pizza' as a description type
*/

-- Drop the existing check constraint
ALTER TABLE ious DROP CONSTRAINT IF EXISTS ious_description_check;

-- Add the updated check constraint with Pizza included
ALTER TABLE ious ADD CONSTRAINT ious_description_check 
CHECK (description IN ('Coffee', 'Beer', 'Meal', 'Walk', 'Ride', 'Pizza'));
