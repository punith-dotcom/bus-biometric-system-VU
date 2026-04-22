-- ============================================================
-- MIGRATION: Add bus/UEN/gender columns to existing tables
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- Safe to run even if columns already exist (uses IF NOT EXISTS)
-- ============================================================

-- Add new columns to USERS table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS uen_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gender     TEXT NOT NULL DEFAULT 'Other' CHECK (gender IN ('Male', 'Female', 'Other')),
  ADD COLUMN IF NOT EXISTS bus_driver TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bus_number TEXT NOT NULL DEFAULT '';

-- Add new columns to ATTENDANCE table
-- First drop old CHECK constraint on event_type, then recreate with new values
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_event_type_check;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_event_type_check CHECK (event_type IN ('time_in', 'time_out')),
  ADD COLUMN IF NOT EXISTS uen_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gender     TEXT NOT NULL DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS bus_driver TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bus_number TEXT NOT NULL DEFAULT '';

-- Add new columns to ENROLLMENT_QUEUE table
ALTER TABLE public.enrollment_queue
  ADD COLUMN IF NOT EXISTS uen_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gender     TEXT NOT NULL DEFAULT 'Other' CHECK (gender IN ('Male', 'Female', 'Other')),
  ADD COLUMN IF NOT EXISTS bus_driver TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bus_number TEXT NOT NULL DEFAULT '';

-- Make sure realtime is enabled on all tables
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollment_queue;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.delete_queue;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Confirm migration done
SELECT 'Migration complete! All new columns added.' AS status;
