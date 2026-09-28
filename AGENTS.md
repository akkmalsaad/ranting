# Ranting — Shared Engineering Guidelines

Version: 1.0 | Established: 2026-09-28

This is the shared project guide for Codex and Claude Code. Read it before work. Keep this filename exactly `AGENTS.md` at the repository root, beside `package.json`. `CLAUDE.md` imports this file; do not maintain duplicate stack rules there.

## 1. Product and scope

Ranting is a Malaysia-first, multi-club martial arts management system. It is NOT the name of a club. Independent silat, taekwondo, BJJ, muay thai, and karate clubs use separate workspaces. A club may have multiple branches. One deployed Ranting application serves many clubs.

Planned modules: club onboarding/settings; overview dashboard; branch creation, details, editing and archiving; students and guardians; recurring classes/calendar; attendance; student progress; monthly fees and payment tracking; proof uploads; income, expenses and basic financial reporting; announcements/events; and a mobile-friendly parent portal. Registration links can be shared through WhatsApp.

This is a roadmap, not evidence that features exist or approval to build every module in one task. Implement the user's current scope. Do not silently introduce subscription prices, club/student limits, belt systems, payment policies or new roles as settled requirements. Martial arts grading rules must be configurable rather than hardcoded to one sport.

## 2. Locked stack and deployment direction

| Area | Project decision |
| --- | --- |
| Application | Next.js App Router + React + TypeScript |
| Styling | Tailwind CSS + shadcn/ui; responsive web UI |
| Package manager | npm; commit and preserve `package-lock.json` |
| Backend | Next.js server-side application logic and Supabase |
| Database | Supabase-managed PostgreSQL |
| Authentication | Supabase Auth, with `@supabase/ssr` for Next.js session integration |
| Files | Supabase Storage; private access by default |
| Data access | `@supabase/supabase-js`, generated database types, reviewed SQL migrations/RPCs |
| Initial database plan | Supabase Free; no automatic paid upgrades |
| Hosting target | Hostinger managed Node.js / Web Apps hosting; not a VPS |
| Source control | Git and GitHub; actual remote must be verified |
| Product format | Responsive web app first; PWA enhancements later when requested |
| Localisation | Malaysia-first; MYR; `Asia/Kuala_Lumpur`; prepare copy for BM/English |

Keep the installed compatible versions in `package.json` and the lockfile. Do not reinstall the latest framework on each session. If bootstrapping a genuinely empty repo, use current stable compatible versions and record them. Use a supported Node LTS version compatible with Next.js and the selected Hostinger runtime; align local development, CI and deployment. Node 24 LTS was proposed, but inspect the repository before choosing or changing it.

Use a separate Ranting Supabase project, never BookFlow's database, keys or buckets. Existing Supabase account can be reused. A separate Ranting Free organization and Singapore region were recommended; verify provisioned resources before connecting. Purchasing hosting, creating accounts and setting credentials have NOT been verified by this guide.

### Planned tools, not automatically installed or fully approved integrations

- Calendar direction: FullCalendar Standard + RRule. Avoid paid Scheduler/resource-view plugins without approval. Store actual class sessions and exceptions so attendance has stable identifiers.
- Scheduled work direction: Supabase Cron + bounded Edge Functions/database functions. Keep jobs retry-safe; don't duplicate schedules across providers.
- Transactional email candidate: Resend. Confirm sender/domain and delivery requirements before enabling.
- Payment candidate: HitPay. Multi-club Malaysian merchant onboarding, settlement, payment methods and fees remain to be confirmed. Do not assume platform functionality is enabled.
- WhatsApp: share registration links first. Cloud API automation requires a separate requested implementation, consent/template handling and cost review. Sharing a link is not WhatsApp authentication.
- Reuse existing icons, form validation, charts and test libraries. Propose additional dependencies only when needed; no parallel competing libraries.

## 3. Read-first and instruction conflicts

At the start of every session:

1. Read this file and `docs/HANDOFF.md` completely. Read relevant README, architecture notes, migrations, tests and any scoped instructions.
2. Inspect `git status --short`, the active branch, recent commits, `package.json`, the lockfile and relevant implementation. Avoid printing secrets.
3. Distinguish planned, implemented, locally verified and deployed. Chat history is not evidence that code exists or tests passed.
4. State a short plan for non-trivial changes and identify any pending decision that would materially change the result.

Follow the agent platform's actual instruction hierarchy. The user's latest explicit project decision supersedes older project decisions; record it here or in the decision history. If repository instructions disagree about stack, security or scope, surface the conflict before changing architecture. Do not add `AGENTS.override.md`, nested conflicting guides or another agent's private plan to bypass this shared agreement. Preserve useful generated Next.js guidance when merging this file into an existing root guide.

## 4. Architecture and code conventions

- Prefer a modular monolith: one Next.js project with shared components and clearly separated business modules. No microservices or standalone Express/Nest backend by default.
- Prefer `src/app`, `src/components/ui`, `src/components`, `src/lib`, `supabase/migrations`, and `docs` for new code. Respect an established equivalent layout; do not reorganize the repo just to match a template.
- Use Server Components by default; client components only for interactivity/browser APIs. Keep secrets and privileged logic in server-only modules.
- Authenticate and authorize every Server Action, API route and privileged operation. Treat request IDs, role values, amounts and hidden form fields as untrusted.
- Centralize domain validation and calculations. Validate on the server even when client validation exists. Do not duplicate fee/payment calculations in several screens.
- Use TypeScript strictness. Avoid unexplained `any`, broad type suppression, disabled lint rules or ignored build failures. Use small named components and explicit domain types.
- Keep server data authoritative. Do not store real club records solely in localStorage, mock arrays or global browser state. Label demo data and isolate fixtures from production.
- Paginate large lists, index tenant/filter columns and select only needed fields. Avoid unbounded queries, N+1 fetches and polling without a reason.
- Do not globally cache authenticated pages or tenant data. Any application cache must be scoped to the correct club and permissions and invalidated on relevant changes.
- User-visible errors must be useful without leaking internals. Preserve loading, empty, error, success and validation states.

## 5. Multi-club security — non-negotiable

- Every club-owned record must have a valid club ownership relationship, normally `club_id`. Use `branch_id` where applicable. Enforce cross-table tenant consistency with appropriate constraints, not UI assumptions.
- Model users, club memberships, staff assignments, students and guardian links separately. A parent can have several children; permissions come from verified links, not matching names or unverified phone numbers.
- Enable and test PostgreSQL Row Level Security on all exposed club-owned tables and Storage policies. Default-deny; never use public allow-all policies as a temporary fix.
- A branch dropdown, hidden button or protected page is not authorization. Apply permissions to reads, writes, exports, file links and server endpoints.
- Proposed access boundaries: owner across own club; branch manager across assigned branches; instructor across assigned classes/students; parent across linked children only. Confirm the exact role matrix before implementing it; never let users assign themselves elevated roles.
- Re-check membership and assignment server-side. Never trust a client-supplied active club. Test a user belonging to more than one club as well as a non-member.
- Use the user's authenticated session for ordinary operations. Privileged keys bypass RLS: reserve them for narrow server-only jobs with explicit authorization and tenant checks.
- Never put service-role/secret keys, database passwords, payment secrets or webhook secrets in `NEXT_PUBLIC_*`, browser code, screenshots, logs, git or handoff notes.
- Keep real values in ignored local environment files and hosting secret settings. Commit only placeholder `.env.example` entries. Never request secrets be pasted into chat.
- Keep proofs and student documents private; use authorized short-lived signed URLs. Validate file type, size, path ownership and access. Public brand assets must be explicitly separated.
- Collect minimal personal data, especially for children. Avoid logging personal records. Document deletion/retention requirements; do not invent a legal compliance guarantee.

## 6. Financial records, schedules and deletion

- Separate fees owed, payments received, allocations, refunds and expenses. Do not collapse everything into a mutable paid/unpaid flag.
- Use integer sen for application monetary calculations and appropriate integer/decimal database columns. Never use floating-point arithmetic for financial totals. Format display amounts as MYR.
- Validate merchant, club, currency, amount and fee mapping when applying gateway events. Verify webhook signatures; make processing idempotent with durable unique event/transaction IDs and transactional updates.
- Never mark a gateway payment paid solely from a success URL or browser message. Uploaded proof stays pending until an authorized review; log reviewer and time.
- Keep parents' club-fee payments separate from clubs' payments for Ranting subscriptions. Do not route all clubs' money into the developer's account by default.
- Enforce unique recurring fee generation for the chosen billing model and period. Retrying a monthly job must not create duplicate charges or receipts.
- Preserve historical billing details when a student, guardian, branch or club setting changes. Prefer archiving referenced records. Do not cascade-delete financial history.
- Record meaningful audit events for payment adjustments, proof review, role changes and destructive actions. Do not log secrets.
- Distinguish collected income from outstanding fees. Label report basis and date filters clearly; obtain agreement on accounting definitions before calling a report P&L.
- Store instants in UTC and render in `Asia/Kuala_Lumpur`; model local dates/billing periods and recurrence timezone explicitly. Handle rescheduled/cancelled sessions without losing attendance history.

## 7. UI and brand consistency

- Use the approved Ranting logos and brand assets. Ranting is the product identity; the selected club's name/logo is separate. Do not regenerate logos, change their proportions or substitute BookFlow/Rapi branding.
- Navy and emerald are the established direction. Inspect supplied assets/design references for exact colour values; do not invent official hex codes. Centralize approved design tokens in the existing theme.
- Modern soft UI: calm surfaces, subtle shadows, clear hierarchy and readable contrast. Use one consistent icon family and reusable UI primitives.
- Manager views must work on desktop/tablet; parent flows must work well on mobile. Avoid clipped dialogs, horizontal overflow and keyboard-obscured actions.
- Support keyboard navigation, labelled fields, visible focus and accessible dialogs. Never convey payment/progress status with colour alone.
- Keep terminology and language consistent with existing screens. Centralize user-facing copy for BM/English; do not arbitrarily translate the entire app mid-task. Ask for the initial default language if unset.
- Implement requested workflows end-to-end. No inert buttons, misleading success toasts or fake persisted changes presented as finished features.

## 8. Changes, migrations and approvals

- Inspect before editing; preserve user changes and the other agent's work. Do not run both agents as simultaneous writers in the same working tree. Use separate branches/worktrees only when the user requests parallel work.
- Make focused patches. No unsolicited rewrites, mass renames, re-scaffolding, framework swaps or lockfile replacement.
- Keep schema/policy/function changes in versioned SQL migrations. Never edit a migration already applied to a shared environment; add a new migration. Document backfills and rollback/recovery steps.
- Test locally or against an explicitly designated test environment. Confirm the target project before migrations. Applying remote migrations, live-data backfills, destructive operations or production deployment requires explicit user authorization.
- Do not delete user data, reset databases, force-push, discard git changes, buy services, send real notifications or process live payments without authorization.
- Do not commit, push, merge or publish unless requested or already explicitly authorized for the task. Provide the proposed commit summary when handing off uncommitted work.
- Ask before adding paid dependencies, replacing providers or changing the agreed stack. Do not use `npm audit fix --force` or broad dependency upgrades as a quick fix.
- No switch to Firebase, MongoDB, Clerk, Prisma/Drizzle, React Native/Expo, WordPress, Laravel, Vercel-only services or another hosting provider without an approved architectural decision.
- Do not add Redux/Zustand, queues, containers, AI features or advanced offline sync merely for future possibilities. Reuse what exists and justify new complexity.

## 9. Validation and definition of done

Read actual scripts first. Typical commands, when configured:

```bash
npm ci
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

Use `npm ci` for a clean install from a valid lockfile, not automatically on every task. Add dependencies intentionally with npm and keep the lockfile consistent. Run the existing test suite and task-specific tests. A build is not a substitute for lint, type checks, security tests or functional checks. If test tooling is absent, report the gap and propose minimal appropriate coverage.

Before marking a feature complete:

- Run relevant automated checks and list actual results, including failures unrelated to the task.
- Verify the real user workflow and persistence. For UI changes, inspect desktop and mobile where tooling permits; disclose when visual testing was not possible.
- Test unauthorized and cross-club access for affected data, including direct requests, parent links, branch limits, exports and files.
- For financial work, test duplicates/retries, partial payments, invalid amounts, unauthorized review and failed gateway events.
- For scheduling work, test recurrence exceptions and Malaysia date boundaries.
- Check for accidental secrets, excessive logging, debug routes, mock data and broken loading/error states.
- Update setup documentation and handoff notes. Never claim a check, deployment or integration succeeded without evidence.

## 10. Hosting and Free-plan guardrails

- Target a standard Next.js Node deployment compatible with Hostinger. No static-only export when server routes/auth/payment handlers are needed. Avoid hard dependencies on Vercel Edge, KV, Blob or Vercel Cron.
- Keep uploads in Supabase Storage rather than the web app's deployment filesystem. Hostinger disk allowance does not increase Supabase Storage allowance, and Hostinger backups must not be assumed to cover external Supabase data.
- Keep secrets out of the repository; document environment variable names, build/start commands, Node version and authentication redirect URLs for local and production environments.
- Supabase Free is a launch decision with limits. Monitor database/storage/egress usage and performance; propose an upgrade with evidence rather than a guessed user count. Do not buy or auto-upgrade.
- Before real club onboarding, establish and test database and uploaded-file backup/recovery processes. Do not treat a database dump as a backup of object bytes. Track Free-plan inactivity-pause risk and operational limitations honestly.
- Hosting plan purchase, exact app/resource quotas, gateway activation and production readiness must be verified independently. This document does not certify capacity or availability.

## 11. Mandatory handoff between agents

Update `docs/HANDOFF.md` at the end of every implementation session or before switching agents. For read-only tasks, update it only when the user authorizes documentation changes or a new decision needs recording.

Record: task, current branch/commit, changed files, completed work, unfinished work, checks actually run with results, migrations created/applied and target environment, environment variable NAMES only, approved decisions, blockers and exact next step. Keep the current summary compact; retain a brief dated decision history. Use Malaysia time with UTC offset.

The next agent must inspect git and code again; a handoff is context, not proof. Do not redo completed work or undo another agent's change merely because a different implementation is preferred. If interrupted, record partial state as soon as possible. End user-facing responses with a concise summary, verification results and remaining blockers.

## 12. Open decisions — ask before assuming

- Role matrix beyond `owner` (admin, staff, parent) and the staff invitation flow. See §13 for the approved owner-only baseline.
- Initial UI language, final design tokens and supplied asset paths.
- Fee calculation rules, family discounts, proration, arrears and refund policy.
- Club merchant onboarding/settlement and Ranting's own subscription billing.
- Parent login/registration method; whether WhatsApp is only a sharing/reminder channel.
- Retention rules, backup destination, recovery expectations and launch checklist.
- Actual repository state, installed versions, Supabase project and hosting status.

## 13. Approved decisions

- 2026-09-28, access model: any authenticated user may create a club and becomes its `owner`. Access is only through `club_members` (`club_role` enum) checked by `private.is_club_member(club_id, roles[])` in RLS; there's no `owner_id` on `clubs`. Clubs are created only through the atomic `public.create_club()` RPC. Nobody can write `club_members` directly. Add future roles with `alter type ... add value` plus new policy migrations.
- 2026-09-28, guardians: `students.guardian_name` / `guardian_phone` are emergency-contact text only and must never grant access. Verified parent links will be separate tables.
- 2026-09-28, archiving: `archived_at` is separate from student status (`active`/`inactive`). The UI archives branches and students and never hard-deletes them.
- 2026-09-28, testing: RLS/tenant isolation is tested with `@electric-sql/pglite` (dev only) running the real migrations over `tests/support/supabase-shim.sql`. That doesn't replace testing against a designated Supabase test project.

Official loading references (verified 2026-09-28):
- Codex: https://developers.openai.com/codex/guides/agents-md/
- Claude Code: https://code.claude.com/docs/en/memory


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
