# Local Auth Server — Design

Date: 2026-08-06

## Problem

Login/session goes through Neon Auth (hosted on the same Neon project whose
compute-time quota is exhausted). Switching `DATABASE_URL` to a local Postgres
(already done — `docker-compose.yml` postgres service + `scripts/dev-postgres.ts`)
fixes app data, but auth is a **separate** system — `pages/api/auth/[...auth0].ts`
proxies every auth action to `NEON_AUTH_BASE_URL`, and `utils/getUser.ts` calls
that same base URL directly (server-to-server) to validate sessions on every
request. Neither goes through `DATABASE_URL`. Result: local dev is fully
blocked on login even with a working local DB.

Constraint: no Neon pay-as-you-go for local dev (~$10+/mo). Local dev needs a
free, fully local auth backend; production keeps using Neon Auth unchanged.

## Approach

Run **Better Auth** (self-hosted, MIT, backs Neon Auth's own REST API shape —
confirmed by route names in `lib/auth/fetchAuth.ts`: `sign-in/email`,
`forget-password`, `two-factor/verify`, etc., which are Better Auth's exact
conventions) as a standalone local process, same pattern as the existing
`redis`/`postgres`/`python-sidecar` mprocs panes.

`NEON_AUTH_BASE_URL` already generically parameterizes both auth call sites —
`[...auth0].ts` and `getUser.ts` — so pointing it at a local Better Auth
server instead of Neon requires **zero logic changes** to either file. Only
`getUser.ts`'s hardcoded session-cookie name needs to become env-driven (see
below).

Scope: email + password only (sign-up, sign-in, sign-out, get-session,
forget-password, reset-password). No social login, no 2FA, no email-otp
locally — confirmed with user, these stay Neon-only / prod-only.

## Architecture

```
Browser → POST /api/auth/sign-in/email (same-origin, Next.js)
        → [...auth0].ts (unchanged) → fetch NEON_AUTH_BASE_URL/sign-in/email
             local:  http://127.0.0.1:8765/api/auth/sign-in/email
             prod:   https://ep-odd-haze-...neonauth.c-3.../neondb/auth/sign-in/email
        → Better Auth (local) validates against local Postgres, Set-Cookie
        → [...auth0].ts relays Set-Cookie back to browser (existing header-relay code)

Any API route → getUser.ts → reads cookie[AUTH_SESSION_COOKIE_NAME]
             → fetch NEON_AUTH_BASE_URL/get-session (server-to-server, no CORS)
```

### New process: `scripts/dev-auth.ts`

- Loads env same as `dev-postgres.ts`/`pipeline-workers.ts`
  (`.env.local` → `.env.development` → `.env`).
- Instantiates Better Auth:
  - Postgres adapter on `DATABASE_URL` (local Postgres — same DB as the app;
    Better Auth's tables (`user`, `session`, `account`, `verification`) live
    alongside the app's Sequelize-managed tables, no conflict).
  - `emailAndPassword: { enabled: true, sendResetPassword }` — the callback
    calls the existing `lib/sendMail.ts` (`sendMail()`), reusing the app's
    Resend/SMTP setup as-is. Better Auth supplies `url` already carrying the
    `redirectTo` the frontend sent (`/auth/reset-password`), so no manual
    link construction.
  - No other plugins (no 2FA, no email-otp, no social providers).
  - `baseURL: http://127.0.0.1:8765`, `basePath: '/api/auth'` (mirrors how
    the Neon URL already includes its own auth path segment, so
    `NEON_AUTH_BASE_URL` stays a single opaque "base + path" value in both
    modes).
  - `trustedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000']`.
  - `secret: process.env.BETTER_AUTH_SECRET` (new local-only secret).
- Before starting the HTTP listener, runs `npx @better-auth/cli migrate
  --yes` against `DATABASE_URL` (idempotent — safe to run every boot, mirrors
  how `dev-postgres.ts` idempotently creates the app database).
- Serves via `toNodeHandler(auth)` on a plain `http.createServer`, listening
  on port 8765.
- Fatal errors (DB unreachable, migrate failure, missing secret) log clearly
  and `process.exit(1)` — mirrors `pipeline-workers.ts`'s fatal-log pattern,
  so mprocs shows the pane DOWN with a readable reason instead of hanging.

### `mprocs.yaml`

New pane `auth: npx tsx scripts/dev-auth.ts`, alongside the existing five.

### `.env.local`

- `NEON_AUTH_BASE_URL` gets the same comment/uncomment toggle already used
  for `DATABASE_URL`: local value active
  (`http://127.0.0.1:8765/api/auth`), Neon prod value commented directly
  below it for easy swap-back.
- New `AUTH_SESSION_COOKIE_NAME=better-auth.session_token` (Better Auth's
  default cookie name — no `__Secure-` prefix, since prefix cookies require
  HTTPS and local dev runs on plain http).
- New `BETTER_AUTH_SECRET=<generated>` (32+ char random, local-only).

### `.env.example`

Document `AUTH_SESSION_COOKIE_NAME`, `BETTER_AUTH_SECRET`, and a comment on
`NEON_AUTH_BASE_URL` explaining the local/prod split — so other devs know
these exist without needing to read this spec.

### `utils/getUser.ts`

```ts
const SESSION_COOKIE = process.env.AUTH_SESSION_COOKIE_NAME || '__Secure-neon-auth.session_token';
```

One-line change. Production doesn't set `AUTH_SESSION_COOKIE_NAME`, so its
behavior is byte-for-byte unchanged.

### `package.json`

New dependency: `better-auth` (`pg` is already a direct dependency, reused
for Better Auth's Postgres adapter).

## Error handling

- Local Postgres unreachable at `dev-auth.ts` boot → migrate step fails,
  clear log, exit 1.
- Missing `BETTER_AUTH_SECRET` → Better Auth throws at construction, fail
  fast with a readable message.
- Resend/SMTP failure during `sendResetPassword` → falls through to
  `sendMail()`'s existing error handling (already handles missing config,
  permanent-vs-transient failures); `forget-password` still returns success
  to the client either way (no user enumeration), failures are server-log
  only — this is existing, unmodified behavior.

## Out of scope

- Social login (Google), 2FA, email-otp — Neon/prod only, per user decision.
- Any change to the production Neon Auth path — `NEON_AUTH_BASE_URL` in
  `.env.production` / Vercel env is untouched.
- Migrating existing Neon Auth users to local — local starts with an empty
  user table by design (fresh local DB already established).

## Testing

1. `npm run dev` → confirm `auth` pane reaches UP (mprocs).
2. Sign up a new account with local email+password → confirm session cookie
   set, confirm an authenticated page/API route resolves the user via
   `getUser.ts`.
3. Sign out → confirm cookie cleared, subsequent authenticated request
   rejected.
4. Forgot-password → confirm a real email arrives via Resend, link opens
   `/auth/reset-password`, submitting a new password succeeds, can sign in
   with it.
5. Restart `npm run dev` → confirm `dev-auth.ts`'s migrate step is a no-op
   (idempotent) and the previously-created local account still exists.
