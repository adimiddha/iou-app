import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cvhhapgjqadethdstewh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aGhhcGdqcWFkZXRoZHN0ZXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzkzNDAsImV4cCI6MjA3OTMxNTM0MH0.Qdg9dIB-uH0wLrj8hF-8aw4pWCz1d-CP-cfeQG4zlrc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
  created_at: string;
};

export type IOUType = 'Coffee' | 'Beer' | 'Meal' | 'Walk' | 'Ride';

export type IOU = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  description: IOUType;
  amount: number;
  created_at: string;
  updated_at: string;
};

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
};
