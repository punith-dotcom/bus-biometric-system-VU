-- ============================================================
-- Biometric Attendance System (Bus) - Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. USERS table
--    Maps a fingerprint sensor slot (1-127) to a student/passenger
CREATE TABLE IF NOT EXISTS public.users (
    id          SERIAL PRIMARY KEY,
    finger_id   INTEGER NOT NULL UNIQUE CHECK (finger_id BETWEEN 1 AND 127),
    name        TEXT    NOT NULL,
    uen_number  TEXT    NOT NULL,           -- Unique Enrollment Number
    gender      TEXT    NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    bus_driver  TEXT    NOT NULL,           -- Assigned bus driver's name
    bus_number  TEXT    NOT NULL,           -- Assigned bus number / route
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ATTENDANCE table
--    Every time-in / time-out event
CREATE TABLE IF NOT EXISTS public.attendance (
    id          BIGSERIAL PRIMARY KEY,
    finger_id   INTEGER NOT NULL REFERENCES public.users(finger_id) ON DELETE CASCADE,
    user_name   TEXT    NOT NULL,
    uen_number  TEXT    NOT NULL,
    gender      TEXT    NOT NULL,
    bus_driver  TEXT    NOT NULL,
    bus_number  TEXT    NOT NULL,
    event_type  TEXT    NOT NULL CHECK (event_type IN ('time_in', 'time_out')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENROLLMENT_QUEUE table
--    Dashboard inserts a row; ESP8266 polls and enrolls the finger, then marks done
CREATE TABLE IF NOT EXISTS public.enrollment_queue (
    id          SERIAL PRIMARY KEY,
    finger_id   INTEGER NOT NULL UNIQUE CHECK (finger_id BETWEEN 1 AND 127),
    user_name   TEXT    NOT NULL,
    uen_number  TEXT    NOT NULL,
    gender      TEXT    NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    bus_driver  TEXT    NOT NULL,
    bus_number  TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DELETE_QUEUE table
--    Dashboard inserts a row; ESP8266 polls and deletes the fingerprint model
CREATE TABLE IF NOT EXISTS public.delete_queue (
    id          SERIAL PRIMARY KEY,
    finger_id   INTEGER NOT NULL UNIQUE CHECK (finger_id BETWEEN 1 AND 127),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_queue   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delete_queue       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_users"            ON public.users            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_attendance"       ON public.attendance       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_enrollment_queue" ON public.enrollment_queue FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_delete_queue"     ON public.delete_queue     FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollment_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delete_queue;

-- ============================================================
-- MIGRATION: if you already ran the old schema, run these
-- ALTER statements to add the new bus/UEN/gender columns:
-- ============================================================
-- ALTER TABLE public.users            ADD COLUMN IF NOT EXISTS uen_number TEXT NOT NULL DEFAULT '';
-- ALTER TABLE public.users            ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'Other';
-- ALTER TABLE public.users            ADD COLUMN IF NOT EXISTS bus_driver TEXT NOT NULL DEFAULT '';
-- ALTER TABLE public.users            ADD COLUMN IF NOT EXISTS bus_number TEXT NOT NULL DEFAULT '';
-- ALTER TABLE public.attendance       ADD COLUMN IF NOT EXISTS uen_number TEXT NOT NULL DEFAULT '';
-- ALTER TABLE public.attendance       ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'Other';
-- ALTER TABLE public.attendance       ADD COLUMN IF NOT EXISTS bus_driver TEXT NOT NULL DEFAULT '';
-- ALTER TABLE public.attendance       ADD COLUMN IF NOT EXISTS bus_number TEXT NOT NULL DEFAULT '';
-- ALTER TABLE public.enrollment_queue ADD COLUMN IF NOT EXISTS uen_number TEXT NOT NULL DEFAULT '';
-- ALTER TABLE public.enrollment_queue ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'Other';
-- ALTER TABLE public.enrollment_queue ADD COLUMN IF NOT EXISTS bus_driver TEXT NOT NULL DEFAULT '';
-- ALTER TABLE public.enrollment_queue ADD COLUMN IF NOT EXISTS bus_number TEXT NOT NULL DEFAULT '';
