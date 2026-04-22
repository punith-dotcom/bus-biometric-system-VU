/**
 * app.js — Supabase client initialisation shared by all dashboard pages.
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  *** SET YOUR SUPABASE CONFIG HERE ***              │
 * │                                                     │
 * │  1. Go to app.supabase.com → your project          │
 * │  2. Settings → API                                  │
 * │  3. Copy "Project URL" and "anon public" key        │
 * └─────────────────────────────────────────────────────┘
 */

const SUPABASE_URL  = 'https://qxczihdefhvoljpjnlss.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4Y3ppaGRlZmh2b2xqcGpubHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODg0NDQsImV4cCI6MjA4ODg2NDQ0NH0.UjG3bLsMHKpPITucImC85HofiBbWl0ziS2RvQI9g6Rw';

// Configuration complete — connected to project qxczihdefhvoljpjnlss

// Expose a single shared Supabase client to every page
window._sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  realtime: { params: { eventsPerSecond: 10 } }
});
