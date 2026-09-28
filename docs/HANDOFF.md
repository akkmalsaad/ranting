# Ranting — Current Agent Handoff

Updated 2026-09-28, Asia/Kuala_Lumpur (UTC+08:00). Agent: Claude Code.

## Current task and state

**Latest session (2026-09-28): Continue with Google.** Built and verified locally; committed and pushed in the commit that follows `e9221f5`. The remote Supabase project and Google Cloud were **not** changed.

- **Button and action:** `GoogleSignIn` (in `src/components/auth/google-button.tsx`) puts the button and an "or" divider above the email form on `/login` and `/signup`. It's a form posting to the `signInWithGoogle` server action, which calls `signInWithOAuth({ provider: "google", redirectTo: SITE_URL/auth/callback })`. The SSR client uses PKCE, so the verifier is stored in a cookie.
- **`/auth/callback`:**
  - Exchanges the code, copies the Google `name` into `user_metadata.full_name` when `full_name` is missing, then redirects to `/workspaces`, which routes to `/workspaces/new` or the club dashboard.
  - `error=access_denied` → `/login?error=oauth_cancelled`; any other failure → `/login?error=oauth`.
  - The login page renders only the fixed `LOGIN_NOTICES` codes.
- **Helpers:** `src/lib/auth-errors.ts` has `LOGIN_NOTICES`, `loginNotice`, `oauthFailure` and `fullNameFromMetadata`, covered by 2 new tests.
- **Checks:**
  - Lint, typecheck and build: pass.
  - Tests: 34/34 pass.
  - Smoke test: callback cancelled, missing-code and server-error paths all redirect correctly; the button and divider render on both pages; unknown `?error=` values are ignored.
  - Not tested: a real Google round trip. It needs the Google client and the Supabase provider configured by the user.
- **Next step:** the user configures Google Cloud and the Supabase Google provider (README "Supabase Auth settings" step 4), adds `/auth/callback` to the redirect URLs, then tests new-user Google → `/workspaces/new` and existing-user Google → dashboard. Apple sign-in is deliberately not added.

### Previous session: self-service accounts

**Self-service accounts (2026-09-28).** Built and verified locally; committed and pushed in the commit that follows `f87e8dc`. The remote Supabase project was **not** changed: the dashboard settings in README "Supabase Auth settings" still have to be applied by the user.

- **Routes:**
  - `/signup` (full name, email, password, confirm) → `/signup/check-email`, which includes a resend-confirmation form.
  - `/forgot-password` → email → `/reset-password`.
  - `/auth/confirm` route handler: handles `token_hash` + `type` (`verifyOtp`) or `code` (`exchangeCodeForSession`), then redirects to a safe `next`. Recovery links always go to `/reset-password`, and failures go to `/login?error=link`.
- **Login page:** now uses the shared `AuthShell`, links to sign-up and to forgot password, and redirects signed-in users away (as does `/signup`). The "provisioned by administrator" copy is removed.
- **Server actions:** moved to `src/app/auth/actions.ts` (`signIn`, `signUp`, `resendConfirmation`, `requestPasswordReset`, `updatePassword`, `signOut`).
  - The full name is stored as `user_metadata.full_name`.
  - An existing email is detected through Supabase's empty `identities`.
  - Reset and resend give the same answer whether or not an account exists, except for rate limits.
- **Shared logic:**
  - `src/lib/validation.ts`: `signUpSchema`, `signInSchema`, `newPasswordSchema`, `passwordResetRequestSchema`, `passwordSchema` and `safeNextPath`.
  - `src/lib/auth-errors.ts`: friendly messages for existing email, weak or same password, unconfirmed email, invalid login, rate limits (429 and `over_*`), invalid email and expired session.
  - `src/lib/site-url.ts` builds email links from `SITE_URL`, never from the Host header.
  - `formValues` no longer echoes any `*password*` field back to the client.
- **Checks:**
  - Lint and typecheck: pass.
  - `npm test`: 32/32 pass (8 new auth tests).
  - Build: pass.
  - `next start` smoke test against the real project, GET requests only: all auth pages render; `/reset-password` with no session shows "Link expired"; `/auth/confirm` with no or invalid parameters and `next=//evil.example` → 307 `/login?error=link`.
  - Not tested: the real sign-up, email delivery, confirmation and reset. They would create users and send email; the user should test them after applying the dashboard settings.
- **Decisions to confirm:**
  - Password policy: 8–72 characters with a letter and a number.
  - New env var `SITE_URL`: server-only, required in production.
- **Next step:** the user applies the README "Supabase Auth settings" (Site URL, redirect URL `/auth/confirm`, the two email templates, minimum password length), then tests sign-up → confirm → create club, and forgot → reset. Custom SMTP is needed before real onboarding.

### Previous session: tenancy, setup, dashboard, branches, students

### What exists

- **Migration `supabase/migrations/20260928120000_club_tenancy.sql`** (applied to Ranting project `namrqbnneljtidyzpshn`):
  - Tables: `clubs`, `club_members`, `branches`, `students`, plus the enum `club_role` (`owner` only).
  - `private.is_club_member(club_id, roles[])`: SECURITY DEFINER, stable, `search_path=''`. Every policy uses it.
  - `public.create_club()`: SECURITY DEFINER RPC that inserts the club and the owner membership in one transaction. Clubs have no insert policy, and `club_members` has no write policies.
  - Privileges: nothing granted to anon. Update grants are column-level, so `club_id` can't be changed.
  - Integrity:
    - A composite FK `students(club_id, branch_id) → branches(club_id, id)` keeps students within their own club's branches.
    - A trigger blocks new assignments to archived branches.
    - Active branch names are unique per club, case-insensitive.
  - All FKs are indexed, plus `club_members(user_id, club_id)` and a student list index. Rollback notes are in the file header.
- **Types:** `src/lib/supabase/database.types.ts` is generated from the live schema (`supabase gen types typescript --linked --schema public`); don't hand-edit it.
  - `gender`/`status` are typed as `string` (check constraints, not enums), and `Update` lists every column (column grants aren't reflected).
  - Code narrows these values through `src/lib/validation.ts`.
  - No code changes were needed after regenerating.
- **Setup flow:**
  - `/workspaces` sends users with no club to `/workspaces/new` and everyone else to `/clubs/<first>`.
  - `createClub` (in `src/app/workspaces/actions.ts`) calls the RPC.
- **Shell:**
  - `src/app/clubs/[clubId]/layout.tsx`: `requireClub` returns 404 for non-members. It renders `ClubNav` (Dashboard, Branches, Students, plus Classes/Fees placeholders) and shows `ClubSwitcher` when the user has more than one club.
  - Dashboard: counts and empty states.
- **Branches:** list (Active/Archived), add, edit, archive/restore. There's no hard delete in the UI.
- **Students:**
  - List: search by name, guardian or phone; filters for All/Active/Inactive/Archived and branch; 25 per page.
  - Add, edit, archive/restore. All requested fields are present.
  - Server actions re-check `requireClub`, validate ids, parse with the shared zod schemas and scope writes by `club_id`.
- **Shared code:**
  - `src/lib/forms.ts` (`parseForm`), `src/lib/validation.ts` (all schemas, `todayInMalaysia`), `src/lib/clubs.ts` (`requireClub`, `listMyClubs`), `src/lib/format.ts`.
  - `ActionForm` (client zod validation, field errors, value refill), plus `field.tsx`, `page-header`, `view-tabs`, `notice` and `coming-soon`.
- **Other changes:**
  - `createClient` reads cookies first, so authenticated pages are never prerendered.
  - The `typecheck` script runs `next typegen` first.
  - Dev dependency added: `@electric-sql/pglite@0.5.8`.

### Changed files

- Updated: `package.json`/lock, `src/lib/supabase/server.ts`, `src/lib/supabase/database.types.ts`, `src/lib/validation.ts`, `src/components/action-form.tsx`, `src/app/workspaces/page.tsx`, `src/app/setup/page.tsx` (copy), `src/app/globals.css` (invalid-field style), README.md, AGENTS.md (§12 wording, new §13 Approved decisions), `tests/validation.test.ts`, this file.
- New: `supabase/migrations/…`, `tests/rls.test.ts`, `tests/support/*`, `src/app/clubs/**`, `src/app/workspaces/{actions.ts,new/}`, `src/components/{field,page-header,view-tabs,notice,coming-soon}.tsx`, `src/components/{clubs,branches,students}/*`, `src/lib/{forms,clubs,format}.ts`.

## Verification (final run)

- `npm run lint`: pass.
- `npm run typecheck` (typegen + tsc): pass.
- `npm test`: 24/24 pass.
  - 16 RLS/integrity tests on PGlite with the real migration: user B can't read, update, delete or insert into user A's club, branches or students.
  - Anon is denied. Nobody can write memberships. There's no direct club insert.
  - Cross-club branch links are rejected, `club_id` changes are rejected, archived-branch assignment is rejected, and a multi-club user sees both clubs.
  - Each rejection asserts its reason.
  - 8 validation tests, including the Malaysia date boundary.
- `npm run build` (Turbopack): pass. The earlier EPERM didn't recur. All authenticated routes are dynamic.
- `next start` smoke test without env: every route redirects to `/setup`. The redirect is streamed in-page because root `loading.tsx` exists, so it isn't an HTTP 307; this was already the case for existing pages.
- After applying the migration and regenerating types: lint, typecheck, 24/24 tests and the build all pass again (the build now loads `.env.local`).
- **Not verified:**
  - Live app flows against the applied schema: PostgREST behaviour, the RPC over HTTP, the `branches!students_club_id_branch_id_fkey` embed and `.or()` search syntax, and sign-in → create club → CRUD flows.
  - Visual desktop/mobile inspection (no browser tool available).
- `git diff --check`: only the pre-existing trailing blank line in CLAUDE.md.

## Blockers and exact next step

1. Create two confirmed test users in Supabase Auth (user action; there's no signup flow).
2. Run `npm run dev` and manually test: sign-in → create club → add branch → add, search, edit and archive a student. Test with the second account to confirm 404 on the first account's club URLs.
3. Update the Supabase Auth Site URL / redirect URLs for local development and, later, production.
4. Future schema changes: add a new migration; applying remotely still needs explicit authorization.

Deferred and still open: staff/parent roles and invitations, verified guardian links, classes, fees, the final language and design tokens.

## Decision history

- 2026-09-28: Shared stack guide established.
- 2026-09-28 (Codex): Auth/app foundation increment.
- 2026-09-28 (user): Owner-only access model approved.
  - Any authenticated user can create a club and becomes its owner.
  - Access goes through `club_members` + `is_club_member()`; there's no `owner_id`.
  - Staff and parent roles are deferred; the enum is extensible.
- 2026-09-28 (user): Guardian name and phone are contact-only student fields.
- 2026-09-28 (user): `archived_at` is separate from active/inactive status. Gender is optional (male/female).
- 2026-09-28 (user): PGlite dev dependency approved for RLS tests.
- 2026-09-28 (user): Google OAuth (PKCE, `/auth/callback`) approved; Apple deferred.
- 2026-09-28 (user): Self-service sign-up with email confirmation and password reset approved; the full name lives in auth user metadata (no profile table yet). The password policy and `SITE_URL` were chosen by the agent and need confirming.
- All of these are recorded in AGENTS.md §13.
