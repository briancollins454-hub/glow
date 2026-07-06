# AGENTS.md

## Cursor Cloud specific instructions

Glow is a single Next.js (App Router) app for UK solo beauty techs (booking,
deposits, patch-test / infill rules, reminders, branded public booking page).
There is **one** service: the Next.js dev server. It talks to a **local Supabase**
stack (Postgres + Auth + Storage + PostgREST) for all data and auth.

Standard commands live in `package.json` (`dev`, `build`, `start`, `lint`).

### Data layer reality (important)

The app is Supabase-only at runtime (`lib/db/queries.ts`, `lib/auth/session.ts`,
`lib/supabase/*`). Despite the README, there is **no local JSON store fallback**.
It reads `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
(server-side, **not** the `NEXT_PUBLIC_*` names in `.env.example`).

The committed `supabase/migrations` chain **cannot be applied from scratch**:
`0001_init.sql` is snake_case / `uuid` ids and table `service_categories`, while
`0002+` and the app use camelCase / `text` ids and table `categories` (plus Stripe
columns no migration adds). So for local dev the migration runner is **disabled**
(`[db.migrations] enabled = false` in `supabase/config.toml`) and the full,
corrected schema is loaded from `supabase/dev-schema.sql` via `[db.seed]`. That
schema is derived from `lib/db/types.ts` — keep the two in sync if the app schema
changes. Do **not** rely on `supabase db push`/migration files locally.

### Starting the environment (services are NOT started by the update script)

The update script only runs `npm install`. Each session, start the services:

1. Start Docker daemon (no systemd in this VM). If `docker info` fails:
   `sudo dockerd > /tmp/dockerd.log 2>&1 &` then `sudo chmod 666 /var/run/docker.sock`.
   Docker is configured for this VM's kernel with `fuse-overlayfs` +
   `containerd-snapshotter: false` in `/etc/docker/daemon.json` and iptables-legacy;
   do not change those or Docker/Supabase containers won't start.
2. Start Supabase: `npx supabase start` (from repo root). It loads
   `supabase/dev-schema.sql`. To rebuild the DB from scratch: `npx supabase db reset`.
3. Write `.env.local` (gitignored) using the keys `npx supabase start` prints:
   `SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_ANON_KEY=<ANON_KEY>`,
   `SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>`, plus
   `NEXT_PUBLIC_APP_URL=http://localhost:3000` and `CRON_SECRET=dev-cron-secret`.
   (The default local keys are stable across restarts.)
4. Seed demo data (creates the demo studio + `demo@glow.app` / `password123`):
   `node scripts/seed.mjs`.
5. Run the app: `npm run dev` (http://localhost:3000). Public booking page is
   `/bellarose`. Supabase Studio: http://127.0.0.1:54323, Mailpit (outbound
   email): http://127.0.0.1:54324.

### Gotchas

- `npm run lint` is **not usable**: the repo ships no ESLint config, so `next lint`
  drops into an interactive setup prompt. Use `npx tsc --noEmit` for static/type
  checking instead. Do not add an ESLint config just to make `next lint` run.
- Payments (Stripe), email (Resend), SMS (Twilio) and Google Calendar are optional
  integrations; the app runs fully without their env vars (stubbed / best-effort).
- After editing `supabase/dev-schema.sql`, apply it with `npx supabase db reset`
  (which re-runs the seed) and then re-run `node scripts/seed.mjs` for demo data.
