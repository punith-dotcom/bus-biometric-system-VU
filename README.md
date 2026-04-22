# Bus Biometric Attendance System

## Project layout

- `Code.ino` — ESP32 firmware source
- `backend/relay/index.ts` — Supabase Edge Function for device and dashboard actions
- `supabase_schema.sql` — Initial database schema for Supabase
- `migrate.sql` — Optional migration script
- `dashboard/index.html` — Main attendance dashboard
- `dashboard/enroll.html` — Admin enrollment and delete management page
- `dashboard/login.html` — Admin login gateway
- `dashboard/styles.css` — Dashboard styles
- `dashboard/app.js` — Shared Supabase client configuration

## Run the dashboard locally

1. Open a terminal.
2. Change to the dashboard folder:
   ```bash
   cd ~/Downloads/BusBiometricAttendance/dashboard
   ```
3. Start a local web server:
   ```bash
   python3 -m http.server 8000
   ```
4. Open the dashboard in your browser:
   `http://localhost:8000/index.html`

## Notes

- `login.html` uses the default passcode `admin123`.
- `dashboard/app.js` already contains the Supabase project URL and anonymous key.
- `backend/relay/index.ts` must be deployed with Supabase CLI and configured with the environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_DB_URL`

## Recommended next steps

- Verify the Supabase project and database schema.
- Deploy the `backend/relay` function to your Supabase project.
- Open the dashboard pages through the local server rather than directly from the filesystem so scripts and CORS behave correctly.
