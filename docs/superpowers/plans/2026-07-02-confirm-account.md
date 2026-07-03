# Confirm Account (email verification) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After registration, the user lands on `/auth/confirm-account` ("Check your e-mail"), receives a confirmation e-mail with a tokenized link; clicking the link verifies the token server-side, persists the confirmation in OUR database, and redirects to `/onboarding`. Unconfirmed users cannot proceed past the confirm page.

**Architecture:** Auth is Neon Auth (upstream, app does NOT own the users table — session gives `{ id, email }` via `utils/getUser.ts`). We add an app-owned `email_confirmations` table (repo idiom: `lib/ensure*` + `db.query`, dual Postgres/SQLite), a token module (random 32B, SHA-256 hash stored, 30 min TTL, single-use, 60s resend cooldown), one API route (status/send/verify), two pages (`/auth/confirm-account` UI per approved mock, `/auth/confirm-email` token landing), and a gate in `_app.tsx`'s `OnboardingGuard`. E-mail via the Resend HTTP API (`RESEND_APIKEY`, plain fetch) in the Surfer confirmation design.

**Tech Stack:** Next.js pages, TypeScript, Resend HTTP API (plain `fetch`, no SDK), raw SQL via `database/database` + `lib/db/query`, Jest.

## Global Constraints

- **Session source of truth:** the user id/email come ONLY from `utils/getUser.ts` (`getUser(req)`); never trust client-provided email/user ids in API routes.
- **Token security:** raw token = `crypto.randomBytes(32).toString('hex')`; DB stores ONLY `sha256(raw)` (`token_hash`); `TOKEN_TTL_MS = 30 min` (matches the mail's "self-destruct in 30 minutes" copy); single-use (the UPDATE itself gates on `token_hash` + expiry); resend cooldown `RESEND_COOLDOWN_MS = 60_000` (429 on violation). Verification looks up by hash — no user enumeration, no timing-sensitive string compare.
- **[RATIFIED] E-mail transport = Resend HTTP API** (`process.env.RESEND_APIKEY`, plain fetch, no SDK dependency), sender `Surfy <noreply@elearning.riskcom.pl>`; NOT the settings-table SMTP `sendMail`. Template = the Surfer confirmation design ("You're a click away" / dark `#222A3A` CTA "Confirm my email address" / "self-destruct in 30 minutes" / support@elearning.riskcom.pl footer). Missing key or API error → `{ sent:false }`, never throw.
- **DB idiom:** mirror `lib/aiTokenUsage.ts` — lazy `ensureEmailConfirmationsTable()` singleton, `CREATE TABLE IF NOT EXISTS`, `isPostgres` PK switch, params via `?`.
- **UI = inline styles** per design.md; tokens: brand `#783AFB`, dark CTA `#2F2F34`, content `#18181B`, muted `#52525C`; `var(--font-family-primary)`; inline SVG only. The confirm page layout follows the approved mock: white left panel (title "Check your e-mail", bold email, buttons "Resend email" dark + "Sign out" text) + purple right panel (visible ≥ xl, `#783AFB`-family bg, "We just sent\nyou an email!" + inline-SVG envelope illustration).
- **Redirects:** confirmed → `/onboarding` (existing page). The `OnboardingGuard` gate (pages/_app.tsx) must allow `/auth/*` routes for unconfirmed users and force everyone else to `/auth/confirm-account` while unconfirmed.
- **Existing users:** no row in `email_confirmations` = NOT confirmed → they confirm once on next visit (accepted one-time cost; decision noted).
- No new TypeScript `any`. Tests: LOCAL mocks only; NEVER touch `jest.config.js`/`jest.setup.js`/`__mocks__/`. Each code task ends `npx tsc --noEmit` clean + its jest suite. **Implementers must NOT run `npm run build`** (controller runs it once at the end). Commit per task with explicit paths.

---

## Task 1 — `lib/emailConfirmation.ts` (table + token store) + tests

**Files:** Create `lib/emailConfirmation.ts`, `__tests__/lib/emailConfirmation.test.ts`

- [ ] Implement, mirroring `lib/aiTokenUsage.ts` idiom:

```ts
import crypto from 'crypto';
import db from '../database/database';
import { queryOne } from './db/query';

export const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 min — matches the mail's "self-destruct in 30 minutes" copy
export const RESEND_COOLDOWN_MS = 60_000;

const isPostgres = !!process.env.DATABASE_URL;

let ready: Promise<void> | null = null;
export function ensureEmailConfirmationsTable(): Promise<void> {
  // CREATE TABLE IF NOT EXISTS email_confirmations (
  //   user_id      TEXT PRIMARY KEY,
  //   email        TEXT NOT NULL,
  //   token_hash   TEXT,
  //   expires_ms   BIGINT,
  //   last_sent_ms BIGINT,
  //   confirmed_ms BIGINT
  // )  — lazy singleton like ensureAiTokenUsageTable (reset `ready` on failure).
}

export const hashToken = (raw: string): string => crypto.createHash('sha256').update(raw).digest('hex');

export interface ConfirmationStatus { confirmed: boolean; email: string | null; lastSentMs: number | null; }

/** No row → { confirmed:false, email:null, lastSentMs:null }. */
export async function getConfirmationStatus(userId: string): Promise<ConfirmationStatus>;

/** Upsert a fresh token for the user. Returns { token } (RAW — caller emails it) or
 *  { cooldownMs } when called again within RESEND_COOLDOWN_MS of last_sent_ms.
 *  Already-confirmed users → { alreadyConfirmed: true } (no token, no email). */
export async function issueConfirmationToken(userId: string, email: string, now?: number):
  Promise<{ token?: string; cooldownMs?: number; alreadyConfirmed?: boolean }>;

/** Single-use verify: find row by token_hash; expired/missing → { ok:false }.
 *  Valid → set confirmed_ms = now, NULL token_hash/expires_ms, return { ok:true }. */
export async function confirmEmailToken(rawToken: string, now?: number): Promise<{ ok: boolean }>;
```

- [ ] Tests (LOCAL `jest.mock('../../database/database')` + `jest.mock('../../lib/db/query')` — capture SQL + params; same approach as other lib tests with db mocks if one exists — check `__tests__/lib/aiTokenUsage.test.ts` for the established mock shape and mirror it):
  - `issueConfirmationToken` returns a 64-hex raw token and stores ONLY its sha256 (assert stored param === `hashToken(returned)` and ≠ raw);
  - second issue within 60s → `{ cooldownMs > 0 }`, no UPDATE of token;
  - issue for a confirmed row → `{ alreadyConfirmed: true }`;
  - `confirmEmailToken` with unknown/expired hash → `{ ok:false }`; valid → `{ ok:true }` and the UPDATE nulls `token_hash` + sets `confirmed_ms` (single-use);
  - `getConfirmationStatus` no-row → `{ confirmed:false, email:null }`; confirmed row → `{ confirmed:true }`.
- **Verify:** `npx tsc --noEmit` clean; `npx jest __tests__/lib/emailConfirmation.test.ts` green. Commit.

## Task 2 — confirmation e-mail (template + send)

**Files:** Create `lib/confirmEmail.ts`; Test `__tests__/lib/confirmEmail.test.ts`

- [ ] `buildConfirmEmailHtml(confirmUrl: string): string` — pure; inline-styled HTML in the Surfer confirmation design (font `Inter, Helvetica, Arial, sans-serif`, max-width 600px, `#ffffff` bg): brand wordmark "Surfy", heading "You're a click away", one sentence, a dark CTA button (`background:#222A3A;color:#fff;border-radius:8px;padding:8px 24px`) reading "Confirm my email address" and linking `confirmUrl`, footer "This email will self-destruct in 30 minutes.", an ignore line, and a `support@elearning.riskcom.pl` support line.
- [ ] `sendConfirmationEmail(email: string, confirmUrl: string)` — sends via the Resend HTTP API (`process.env.RESEND_APIKEY`, plain `fetch`, no SDK), sender `Surfy <noreply@elearning.riskcom.pl>`, subject `Confirm your e-mail — Surfy`; missing key or API error → `{ sent:false }`, never throws.
- [ ] Tests (pure part only): html contains `confirmUrl` exactly once in the href, contains "30 minutes", no `${` leftovers; LOCAL mock of `fetch` verifying subject + to, and `{ sent:false }` when the key is unset.
- **Verify:** tsc clean; suite green. Commit.

## Task 3 — API route `/api/confirm-account`

**Files:** Create `pages/api/confirm-account.ts`; Test `__tests__/api/confirm-account.test.ts`

- [ ] One handler, session-guarded via `getUser(req)` (401 when no session):
  - `GET` → `{ confirmed, email }` from `getConfirmationStatus(user.id)`; when the row's email is null fall back to session email.
  - `POST {}` (send/resend) → `issueConfirmationToken(user.id, user.email)`; on `{ token }` build `confirmUrl = \`${origin}/auth/confirm-email?token=${token}\`` (origin from `req.headers.origin` fallback `process.env.NEXT_PUBLIC_APP_URL` fallback `https://${req.headers.host}`) and `sendConfirmationEmail`; respond `{ sent: true }`; on `{ cooldownMs }` → 429 `{ cooldownMs }`; on `{ alreadyConfirmed }` → `{ confirmed: true }`.
  - `PUT { token }` (verify — used by the landing page) → NO session required (the click may land in a fresh browser): `confirmEmailToken(token)` → `{ ok }`; 400 on missing/malformed token (non-string or length ≠ 64).
- [ ] Tests with LOCAL mocks of `utils/getUser`, `lib/emailConfirmation`, `lib/confirmEmail`: 401 unauthenticated GET/POST; GET passes through status; POST sends with a URL containing the raw token; POST during cooldown → 429; PUT valid → `{ ok:true }`; PUT invalid token shape → 400 and `confirmEmailToken` NOT called.
- **Verify:** tsc clean; suite green. Commit.

## Task 4 — page `/auth/confirm-account` (UI per approved mock)

> UI task — run `/frontend-design`, read `design.md` first.

**Files:** Create `pages/auth/confirm-account.tsx`

- [ ] Layout per the approved mock (inline styles; do NOT use the Tailwind classes from the mock verbatim — translate to inline styles):
  - Full-viewport two-panel flex: LEFT white panel (grows), content centered: title **"Check your e-mail"** (18px, 600, `#18181B`), body **"We sent a temporary link to the email address, {email}." / "Please check your Spam folder as well."** with the e-mail **bold**; buttons row: **"Resend email"** (dark `#2F2F34`, white text, radius 8, hover `#783AFB`, disabled+"Sent!"/countdown during the 60s cooldown using the 429 `cooldownMs`) and **"Sign out"** (borderless text button, muted `#52525C`, hover darker).
  - RIGHT purple panel, hidden below 1280px (`window` matchMedia or CSS via a wrapper class — simplest: inline style with a `useEffect`-driven media query or the existing responsive pattern in `AuthSplitLayout.tsx` — check and mirror it): bg `#783AFB`, rounded 12, centered column: **"We just sent" / "you an email!"** (30px, 700, white, tracking -2px) + an inline-SVG illustration (white envelope, open flap, an orange-bordered card with two dark eyes peeking out — simple flat shapes, ~200px).
  - The e-mail shown comes from the session (`authClient` hook or `GET /api/confirm-account`).
  - On mount: `GET /api/confirm-account`; if `confirmed` → `router.replace('/onboarding')`; else `POST` once to trigger the initial send (the 60s cooldown makes double-mounts harmless).
  - "Resend email" → `POST`; on 429 show the countdown; on success brief "Sent!" state.
  - "Sign out" → the same sign-out call `pages/auth/sign-out.tsx` uses (check it; likely `authClient.signOut()` then redirect `/auth/sign-in`).
- **Verify:** `npx tsc --noEmit` clean. Structure: two panels, correct copy, resend cooldown behavior, sign-out wired. Commit.

## Task 5 — page `/auth/confirm-email` (token landing)

**Files:** Create `pages/auth/confirm-email.tsx`

- [ ] Reads `token` from `router.query`; on mount `PUT /api/confirm-account { token }`:
  - success → `router.replace('/onboarding')`;
  - failure → small centered card (white, border `#F4F4F5`, radius 12): "This confirmation link is invalid or has expired." + a dark button "Send a new link" → `router.push('/auth/confirm-account')`.
  - While verifying: minimal "Confirming…" state (muted text; no spinner library).
- **Verify:** tsc clean. Structure: verifies once, redirects on success, error state navigates to resend. Commit.

## Task 6 — gate in `OnboardingGuard` (+ whitelist)

**Files:** Modify `pages/_app.tsx`; Test: extend nothing (structure-verified; guard logic is a thin fetch + redirect)

- [ ] In `OnboardingGuard` (pages/_app.tsx:38-111): after the `user` check and BEFORE the onboarding-completed check, fetch `GET /api/confirm-account` (react-query like the neighboring onboarding fetch — mirror its pattern; cache it, no refetch storm):
  - `confirmed === false` and route is NOT under `/auth/` → `router.replace('/auth/confirm-account')`.
  - `/auth/confirm-account` + `/auth/confirm-email` must be reachable for a logged-in unconfirmed user (they're under `/auth/` which the guard already treats as public — VERIFY that at line ~48 and adjust the early-return so a logged-in user on `/auth/confirm-account` is not bounced away by any "already signed in" redirect).
  - Confirmed users visiting `/auth/confirm-account` → redirect `/` (which routes to onboarding/workspace as today).
- [ ] Loading order: while the confirm status is loading, render the same loading state the guard already uses for onboarding (no flash of protected content).
- **Verify:** `npx tsc --noEmit` clean. Structure walkthrough: unconfirmed → forced to confirm page; confirm link → DB write → `/onboarding`; confirmed → app as today. Commit.

---

## Verification Summary
- Tasks 1–3: jest (token store, template, API guard) + tsc.
- Tasks 4–6: tsc + structure checks (`/frontend-design` for Task 4).
- Controller at the end: full `npm run build` + whole-branch review.

## Task count
**6 tasks.** Rationale: one lib (store), one mail module, one API route, two pages, one guard wiring — each independently testable/committable.
