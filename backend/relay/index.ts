/**
 * Supabase Edge Function: relay
 * Bus Biometric Attendance — ESP32-S3 + R307 + GPS NEO-7M + SIM800C
 *
 * Handles:
 *  1. Fingerprint scan → time_in / time_out  (ESP32)
 *  2. Delete queue check / confirm           (ESP32)
 *  3. Enrollment queue check / confirm       (ESP32)
 *  4. action=enroll   → auto-migrate + insert enrollment (Dashboard)
 *  5. action=users    → return registered users JSON     (Dashboard)
 *  6. action=delete_user → queue a deletion              (Dashboard)
 *  7. action=bus_location → latest GPS location per bus  (Dashboard)
 *
 * Deploy:
 *   supabase functions deploy relay --no-verify-jwt
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Pool }         from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DB_URL        = Deno.env.get("SUPABASE_DB_URL")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const TEXT_CORS = { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const contentType = req.headers.get("content-type") || "";
  let params: URLSearchParams;
  if (contentType.includes("application/json")) {
    const j = await req.json();
    params = new URLSearchParams(Object.entries(j).map(([k, v]) => [k, String(v)]));
  } else {
    params = new URLSearchParams(await req.text());
  }

  const action = params.get("action");

  // ──────────────────────────────────────────────────────────
  // DASHBOARD: Enroll — auto-migrates schema then inserts
  // ──────────────────────────────────────────────────────────
  if (action === "enroll") {
    const fingerId  = parseInt(params.get("finger_id") || "0");
    const userName  = params.get("user_name")  || "";
    const uenNumber = params.get("uen_number") || "";
    const pickupLocation = params.get("pickup_location") || "";
    const gender    = params.get("gender")     || "Other";
    const busDriver = params.get("bus_driver") || "";
    const busNumber = params.get("bus_number") || "";
    if (!fingerId || !userName)
      return new Response(JSON.stringify({ error: "finger_id and user_name are required" }), { status: 400, headers: CORS });

    const pool = new Pool(DB_URL, 1, true);
    const conn = await pool.connect();
    try {
      // Auto-migration — adds ALL new columns idempotently
      await conn.queryObject(`
        ALTER TABLE public.users              ADD COLUMN IF NOT EXISTS uen_number  TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.users              ADD COLUMN IF NOT EXISTS gender      TEXT NOT NULL DEFAULT 'Other';
        ALTER TABLE public.users              ADD COLUMN IF NOT EXISTS bus_driver  TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.users              ADD COLUMN IF NOT EXISTS bus_number  TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.users              ADD COLUMN IF NOT EXISTS pickup_location TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.attendance         DROP CONSTRAINT IF EXISTS attendance_event_type_check;
        ALTER TABLE public.attendance         ADD CONSTRAINT attendance_event_type_check CHECK (event_type IN ('time_in','time_out'));
        ALTER TABLE public.attendance         ADD COLUMN IF NOT EXISTS uen_number  TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.attendance         ADD COLUMN IF NOT EXISTS gender      TEXT NOT NULL DEFAULT 'Other';
        ALTER TABLE public.attendance         ADD COLUMN IF NOT EXISTS bus_driver  TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.attendance         ADD COLUMN IF NOT EXISTS bus_number  TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.attendance         ADD COLUMN IF NOT EXISTS pickup_location TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.attendance         ADD COLUMN IF NOT EXISTS latitude    DOUBLE PRECISION DEFAULT NULL;
        ALTER TABLE public.attendance         ADD COLUMN IF NOT EXISTS longitude   DOUBLE PRECISION DEFAULT NULL;
        ALTER TABLE public.enrollment_queue   ADD COLUMN IF NOT EXISTS uen_number  TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.enrollment_queue   ADD COLUMN IF NOT EXISTS gender      TEXT NOT NULL DEFAULT 'Other';
        ALTER TABLE public.enrollment_queue   ADD COLUMN IF NOT EXISTS bus_driver  TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.enrollment_queue   ADD COLUMN IF NOT EXISTS bus_number  TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.enrollment_queue   ADD COLUMN IF NOT EXISTS pickup_location TEXT NOT NULL DEFAULT '';
      `);

      await conn.queryObject(
        `INSERT INTO public.enrollment_queue (finger_id, user_name, uen_number, gender, bus_driver, bus_number, pickup_location, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         ON CONFLICT (finger_id) DO UPDATE
           SET user_name=$2, uen_number=$3, gender=$4, bus_driver=$5, bus_number=$6, pickup_location=$7, status='pending'`,
        [fingerId, userName, uenNumber, gender, busDriver, busNumber, pickupLocation]
      );
      return new Response(JSON.stringify({ success: true }), { headers: CORS });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
    } finally { conn.release(); await pool.end(); }
  }

  // ──────────────────────────────────────────────────────────
  // DASHBOARD: Get all registered users
  // ──────────────────────────────────────────────────────────
  if (action === "users") {
    const pool = new Pool(DB_URL, 1, true);
    const conn = await pool.connect();
    try {
      const result = await conn.queryObject(
        `SELECT id, finger_id, name, uen_number, gender, bus_driver, bus_number, pickup_location, created_at
         FROM public.users ORDER BY finger_id`
      );
      return new Response(JSON.stringify(result.rows), { headers: CORS });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
    } finally { conn.release(); await pool.end(); }
  }

  // ──────────────────────────────────────────────────────────
  // DASHBOARD: Latest GPS location per bus number
  // ──────────────────────────────────────────────────────────
  if (action === "bus_location") {
    const pool = new Pool(DB_URL, 1, true);
    const conn = await pool.connect();
    try {
      // Get last recorded GPS location per bus
      const result = await conn.queryObject(`
        SELECT DISTINCT ON (bus_number)
          bus_number, bus_driver, latitude, longitude, created_at
        FROM public.attendance
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY bus_number, created_at DESC
      `);
      return new Response(JSON.stringify(result.rows), { headers: CORS });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
    } finally { conn.release(); await pool.end(); }
  }

  // ──────────────────────────────────────────────────────────
  // DASHBOARD: Queue a deletion
  // ──────────────────────────────────────────────────────────
  if (action === "delete_user") {
    const fingerId = parseInt(params.get("finger_id") || "0");
    if (!fingerId) return new Response(JSON.stringify({ error: "finger_id required" }), { status: 400, headers: CORS });
    const { error } = await supabase.from("delete_queue").upsert({ finger_id: fingerId });
    return new Response(JSON.stringify({ success: !error, error: error?.message }), { headers: CORS });
  }

  // ──────────────────────────────────────────────────────────
  // ESP32: Fingerprint scan → time_in / time_out + GPS
  // ──────────────────────────────────────────────────────────
  if (params.has("FingerID")) {
    const fingerId = parseInt(params.get("FingerID")!);
    const lat = params.get("lat") ? parseFloat(params.get("lat")!) : null;
    const lng = params.get("lng") ? parseFloat(params.get("lng")!) : null;

    const pool = new Pool(DB_URL, 1, true);
    const conn = await pool.connect();
    try {
      const userRes = await conn.queryObject<{name:string,uen_number:string,gender:string,bus_driver:string,bus_number:string,pickup_location:string}>(
        `SELECT name, uen_number, gender, bus_driver, bus_number, pickup_location FROM public.users WHERE finger_id=$1`, [fingerId]
      );
      if (!userRes.rows.length) return new Response("unknownUnregistered finger", { headers: TEXT_CORS });

      const user = userRes.rows[0];
      const lastRes = await conn.queryObject<{event_type:string}>(
        `SELECT event_type FROM public.attendance WHERE finger_id=$1 ORDER BY created_at DESC LIMIT 1`, [fingerId]
      );
      const eventType = !lastRes.rows.length || lastRes.rows[0].event_type === "time_out" ? "time_in" : "time_out";

      await conn.queryObject(
        `INSERT INTO public.attendance
           (finger_id, user_name, uen_number, gender, bus_driver, bus_number, pickup_location, event_type, latitude, longitude)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [fingerId, user.name, user.uen_number, user.gender, user.bus_driver, user.bus_number, user.pickup_location, eventType, lat, lng]
      );
      return new Response(`${eventType}${user.name}`, { headers: TEXT_CORS });
    } finally { conn.release(); await pool.end(); }
  }

  // ──────────────────────────────────────────────────────────
  // ESP32: Check delete queue
  // ──────────────────────────────────────────────────────────
  if (params.get("DeleteID") === "check") {
    const { data: row } = await supabase.from("delete_queue").select("id,finger_id").order("created_at").limit(1).maybeSingle();
    if (!row) return new Response("", { headers: TEXT_CORS });
    await supabase.from("delete_queue").delete().eq("id", row.id);
    await supabase.from("users").delete().eq("finger_id", row.finger_id);
    return new Response(`del-id${row.finger_id}`, { headers: TEXT_CORS });
  }

  // ──────────────────────────────────────────────────────────
  // ESP32: Check enrollment queue
  // ──────────────────────────────────────────────────────────
  if (params.get("Get_Fingerid") === "get_id") {
    const { data: row } = await supabase.from("enrollment_queue").select("id,finger_id").eq("status","pending").order("created_at").limit(1).maybeSingle();
    if (!row) return new Response("", { headers: TEXT_CORS });
    return new Response(`add-id${row.finger_id}`, { headers: TEXT_CORS });
  }

  // ──────────────────────────────────────────────────────────
  // ESP32: Confirm enrollment complete
  // ──────────────────────────────────────────────────────────
  if (params.has("confirm_id")) {
    const fingerId = parseInt(params.get("confirm_id")!);
    const pool = new Pool(DB_URL, 1, true);
    const conn = await pool.connect();
    try {
      const qRes = await conn.queryObject<{finger_id:number,user_name:string,uen_number:string,gender:string,bus_driver:string,bus_number:string,pickup_location:string}>(
        `SELECT * FROM public.enrollment_queue WHERE finger_id=$1 AND status='pending' LIMIT 1`, [fingerId]
      );
      if (qRes.rows.length) {
        const r = qRes.rows[0];
        await conn.queryObject(
          `INSERT INTO public.users (finger_id, name, uen_number, gender, bus_driver, bus_number, pickup_location)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (finger_id) DO UPDATE
             SET name=$2, uen_number=$3, gender=$4, bus_driver=$5, bus_number=$6, pickup_location=$7`,
          [r.finger_id, r.user_name, r.uen_number, r.gender, r.bus_driver, r.bus_number, r.pickup_location]
        );
        await conn.queryObject(`UPDATE public.enrollment_queue SET status='done' WHERE finger_id=$1`, [fingerId]);
      }
      return new Response("Enrolled Successfully!", { headers: TEXT_CORS });
    } finally { conn.release(); await pool.end(); }
  }

  return new Response("Bad Request", { status: 400 });
});
