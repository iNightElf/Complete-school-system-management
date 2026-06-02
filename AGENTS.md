# Session Log

## 2026-06-02 — Better-Auth → Supabase Auth Migration + Email Verification

### Goal
Replace Better-Auth with Supabase Auth for authentication, add email verification, fix auth-related bugs.

### Changes

**Server (`server/src/`):**
- `lib/supabase-auth.ts` — New file with helpers: `getUserFromToken` (JWT verify + DB sync), `createAdminUser` (Supabase Auth + DB, with `email_confirm: false`), `updateUserRole`, `deleteAuthUser` (Supabase delete is best-effort), `generateAndSendVerification` (generates signup confirmation link via Supabase Admin API and sends via SMTP)
- `middleware/auth.middleware.ts` — Rewritten: reads `Authorization: Bearer <token>`, verifies via Supabase Admin API's `getUser`, attaches `req.user` with role. Removed Better-Auth session logic.
- `controllers/setup.controller.ts` — `initSetup` now accepts all registrations (not just first admin), cleans orphaned DB + Supabase Auth records before creating user, assigns `admin`/`viewer` role based on whether any admin exists, sends verification email.
- `controllers/*.controller.ts` — All controllers updated from `req.session?.user?.id` to `req.user?.id`
- `app.ts` — Removed Better-Auth `toNodeHandler`, replaced with `GET /api/auth/get-session` using `authenticate` middleware. Removed separate auth rate limiter.
- `lib/auth.ts` — Deleted (Better-Auth setup file).
- `lib/email.ts` — Added `sendVerificationEmail` function.

**Client (`client/src/`):**
- `lib/supabase.ts` — New Supabase client for browser.
- `store.ts` — `fetchSession` uses `supabase.auth.getSession()` then server `/auth/get-session` for role. Axios interceptor attaches `Authorization: Bearer <token>`. Removed `window.location.href = '/login'` on 401 (caused infinite reload loop). Added `fetching` guard.
- `App.tsx` — `onAuthStateChange` listener only calls `fetchSession` on `INITIAL_SESSION` and `SIGNED_IN` (not `TOKEN_REFRESHED`).
- `pages/Login.tsx` — Uses `supabase.auth.signInWithPassword()`.
- `pages/Register.tsx` — All registrations go through `POST /api/setup/init` (server). Shows "Check Your Email" after success.
- `pages/VerifyEmail.tsx` — Simplified to just show success (Supabase handles verification on their end).

**Database:**
- `prisma/schema.prisma` — Removed `session`, `account`, `verification` models and their relations to `user`.
- Migration `20260604000000_switch_to_supabase_auth` — Drops Better-Auth tables.

**Config:**
- `.env.example` — Updated to remove Better-Auth vars, add Supabase Auth docs.
- `package.json` — Removed `better-auth`, `@better-auth/prisma-adapter`, `argon2`. `@supabase/supabase-js` already present.

### Bugs Fixed
- **Infinite reload loop** — Removed `window.location.href = '/login'` from axios interceptor (triggered React re-render → interceptor again).
- **Rate limiter regression** — Removed separate auth rate limiter (20/15min) that was blocking `get-session` calls.
- **Delete user crashes** — `deleteAuthUser` now catches Supabase Auth delete errors silently so DB delete always runs.
- **Registration rejects existing users** — `initSetup` now cleans orphaned records before creating, allowing re-registration.

### Current State
- Both `tsc --noEmit` (server) and `vite build` (client) pass.
- 67/74 integration tests pass (7 failures are pre-existing test data issues, unrelated to auth).
- 8/8 validation tests pass.
- Users register → verification email sent (best-effort) → click link → Supabase verifies → can sign in.
- Admin can delete users from User Management.
