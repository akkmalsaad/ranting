# Ranting

Malaysia-first management for independent martial arts clubs. Each club will have its own workspace and branches.

## Current implementation

Implemented locally, with no live database connected yet:

- **Auth:** Supabase SSR sessions with email and password.
  - Self-service sign-up (`/signup`) requires email confirmation; the full name is stored in user metadata.
  - Sign-in and sign-out, and a forgot/reset password flow (`/forgot-password` → email → `/reset-password`).
  - Email links land on `/auth/confirm`.
- **Club tenancy (`supabase/migrations/`):** clubs, club memberships (`owner` role), branches and students.
  - Row Level Security is on every table, with membership checked through `private.is_club_member()`.
  - Clubs are created atomically with their owner through `create_club()`.
- **Club setup:** a user without a club is sent to `/workspaces/new`; otherwise to their club dashboard.
- **Club workspace:** dashboard, branches (add/edit/archive/restore), and students (search, filters, pagination, add/edit/archive/restore). There's a club switcher for owners of several clubs. Classes and Fees are labelled "not available yet".

**Not implemented:** staff/parent roles, invitations, verified guardian links, classes, attendance, fees, payments, uploads, announcements and reports. Guardian name/phone on a student are contact details only.

## Local development

Use Node 24 LTS (`.nvmrc`). Existing Next 16.3.6 / React 19.2.8 versions are preserved.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

With blank variables, the app shows `/setup`. Configure only a **separate Ranting** Supabase Free project; never reuse BookFlow:

- `NEXT_PUBLIC_SUPABASE_URL`: Ranting project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Ranting publishable API key, never a service-role/secret key.
- `SITE_URL` (server-only): public origin used in auth email links, e.g. `https://app.example.com`, with no trailing slash. It's optional locally (defaults to `http://localhost:3000`) and **required in production**.

Keep actual values in ignored `.env.local`. Restart after changes. Configure Supabase Auth as described in [Supabase Auth settings](#supabase-auth-settings), then create an account at `/signup`. Apply the database migration before using club features (see below). Do not onboard real clubs yet.

### Database migrations

Migrations live in `supabase/migrations/` and follow the Supabase CLI naming convention. The repo doesn't include the Supabase CLI or a `config.toml`. Apply migrations to a Ranting project **only after the target project is confirmed** and applying is explicitly authorised. Either:

- Supabase CLI: `supabase link --project-ref <ranting-ref>`, then `supabase db push`, or
- Dashboard SQL editor: run each migration file once, in filename order.

Never edit a migration that has already been applied; add a new one. After applying, regenerate types with `supabase gen types typescript --linked > src/lib/supabase/database.types.ts` (the current file is hand-written to match).

Session cookies are handled by `@supabase/ssr`; proxy refreshes the session, pages/actions verify users, and responses use `private, no-store`. No privileged API key is used. See [Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs) and [shadcn manual setup](https://ui.shadcn.com/docs/installation/manual).

## Supabase Auth settings

Set these in the Supabase dashboard for the Ranting project. The app doesn't change them itself.

1. **Authentication → URL Configuration:**
   - **Site URL:** `http://localhost:3000` while developing; change it to the production origin at launch.
   - **Redirect URLs:** add `http://localhost:3000/auth/confirm`, then the production equivalent (`https://<your-domain>/auth/confirm`) at launch.
2. **Authentication → Sign In / Providers → Email:**
   - Keep **Confirm email** on.
   - Set the minimum password length to 8 or less so it doesn't conflict with the app's policy.
3. **Authentication → Emails → Templates:** replace the link in these two templates so confirmation works from any device or browser:
   - **Confirm signup:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/workspaces/new`
   - **Reset Password:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

   The default templates also work through `/auth/confirm?code=…`, but only in the browser where the request was made.
4. The built-in email sender is rate-limited and meant for testing. Configure custom SMTP (for example Resend, once approved) before real clubs sign up.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

If this execution environment prevents Turbopack from binding a process port, use `npm run build -- --webpack` and `npm run dev -- --webpack`. This does not change the production architecture. Tests use Node's built-in test runner:

- `tests/validation.test.ts` covers the domain schemas.
- `tests/rls.test.ts` applies the real migrations to an in-memory Postgres (PGlite) with a small Supabase shim (`tests/support/`). It checks cross-club isolation, the membership rules and tenant integrity.

These tests don't replace verification against a designated Supabase test project. `typecheck` runs `next typegen` first to generate the route types.

## Hosting direction

Standard Node.js deployment on Hostinger managed Node.js/Web Apps. Verify Node 24 availability before deployment. Install with `npm ci`, build with `npm run build`, start with `npm start` (platform `PORT` supported). Configure the three environment variable names above at build/runtime (`SITE_URL` = the production origin), use HTTPS, add the production URLs to Supabase Auth (see below), and disable shared CDN caching for authenticated routes. Hostinger provisioning and capacity are unverified. No static export or Vercel-specific services.

Before real onboarding: apply the migration to a confirmed project and re-run the isolation checks there, confirm the wider role matrix, verify database/storage backup and restore procedures and retention rules. No storage buckets or upload policies exist yet. Start with Supabase Free; no upgrade has been purchased. No Git remote is configured.
