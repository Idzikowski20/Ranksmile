# Ably Realtime "Follow Mode" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public share-link viewers see the owner's article changes live (content + text caret) and live comments, via Ably Pub/Sub — single-writer "follow mode", not collaborative co-editing.

**Architecture:** One Ably channel per article (`article:{id}`) carrying three event names: `content`, `caret`, `comment`. The authenticated OWNER (the editor page) is the sole publisher of `content`/`caret`; viewers subscribe read-only. `comment` events are published server-side from the comments API after the DB write (so they reach owner + all viewers). A capability-scoped token endpoint (`/api/ably-token`) grants the owner publish+subscribe and viewers subscribe-only. The viewer page renders the article in a **read-only Tiptap editor** (same schema as the author) so caret positions map and HTML is sanitized by schema-parse.

**Tech Stack:** Next.js 12 (pages-router), React 18, TypeScript 5.4, Tiptap v3 / ProseMirror, `ably` v2 (+ `ably/react` hooks), Sequelize raw queries over Neon Postgres / SQLite, Jest 29 + React Testing Library.

**Key decisions (locked during brainstorming — see `~/.claude/.../memory/serpbear-realtime-architecture.md`):**
- Single writer ⇒ no CRDT/Yjs, no merge conflicts. Surfy/Auto-Optimize `setContent` flows through the same one-way broadcast.
- **Autosave is unchanged and independent.** Autosave = HTTP `PUT /api/articles/{id}` → DB (source of truth). Ably broadcast is a SEPARATE, parallel, fire-and-forget layer. An Ably failure must NEVER block a DB save, and vice versa.
- Transport = Ably Pub/Sub only. No LiveSync, no outbox, no logical replication, no `pg_notify`, no sidecar.
- Comments move from the in-process `commentBus`/SSE (broken on Vercel serverless) to Ably. We keep `emitCommentChange` calls in place (harmless) and switch clients to Ably, so the old SSE path stays as a non-load-bearing fallback during rollout.

**Standing repo constraints (MUST follow):**
- Commit ONLY specifically-named files. NEVER `git add -A` / `git add .`.
- NEVER touch/stage/modify/delete `.env`, `.env.production`, `components/settings/NotificationSettings.tsx`, `public/female.jpg`, `public/male.jpg`, `python-sidecar/__pycache__/*.pyc`. (Editing `.env.example` IS allowed.)
- Commit to `main` locally; push only when the user says "push".
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Run `graphify update .` after commits.
- The repo lives at `C:\Users\patry\Desktop\serpbear`. All paths below are relative to that root.

**Review-driven revisions (v1.1):** content throttle is 500 ms; every `content`/`caret` event carries a monotonic `rev` so the viewer never draws a caret against a doc it hasn't rendered; the viewer preserves scroll across content swaps; on (re)connect the viewer refetches `/api/share` to resync to the source of truth (Ably `connected` event); owner + viewers both enter presence so the viewer can show "editor live/away" and a reviewer count; a connection-state toast covers reconnect UX. Deferred to v2 with rationale: ProseMirror-step (diff) broadcast + payload compression (only worth it past the 56 KB cap), and a real error tracker (Sentry/Logtail) which is a cross-cutting infra decision, not part of this feature.

---

## File Structure

**New files:**
- `lib/ably/channel.ts` — pure helper: `articleChannelName(id)` + event-name constants. Shared by server & client (no Ably import, no side effects).
- `lib/ably/server.ts` — server singleton `Ably.Rest`; `publishToArticle(articleId, event, data)` (fire-and-forget, swallows errors); `mintArticleToken(...)`.
- `lib/throttle.ts` — pure `throttle(fn, ms)` (trailing-edge) used by the editor's content/caret publishers.
- `pages/api/ably-token.ts` — capability-scoped Ably token endpoint (owner → publish+subscribe+presence; viewer → subscribe+presence).
- `lib/ably/useArticleChannel.ts` — client hook: builds an `Ably.Realtime` bound to `/api/ably-token` for a given article and returns the channel; handles teardown.
- `components/articles/ViewerEditor.tsx` — read-only Tiptap editor for the public viewer (content render + caret mapping + schema sanitization).
- Tests: `__tests__/lib/ablyChannel.test.ts`, `__tests__/lib/ablyServer.test.ts`, `__tests__/lib/throttle.test.ts`, `__tests__/api/ably-token.test.ts`, `__tests__/api/comments-publish.test.ts`.

**Modified files:**
- `.env.example` — add `ABLY_API_KEY`.
- `package.json` — add `ably` dependency.
- `pages/api/articles/[id]/comments.ts` — publish `comment` events to Ably after each mutation (lines 107/135/146).
- `components/articles/comments/CommentsLayer.tsx` — subscribe to Ably `comment` events instead of (in addition to) EventSource.
- `pages/drafts/s/[token].tsx` — render via `ViewerEditor`; subscribe to `content`/`caret` events; show ghost caret + presence.
- `pages/articles/[id]/index.tsx` — owner publishes throttled `content` + `caret`; subscribes to `comment` events to bump `commentsVersion`.

---

## Task 1: Channel-name helper + install Ably + env

**Files:**
- Create: `lib/ably/channel.ts`
- Create: `__tests__/lib/ablyChannel.test.ts`
- Modify: `package.json` (add dependency)
- Modify: `.env.example` (add `ABLY_API_KEY`)

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/ablyChannel.test.ts`:

```typescript
import { articleChannelName, ABLY_EVENTS } from '../../lib/ably/channel';

describe('ably channel helper', () => {
  it('builds a stable per-article channel name', () => {
    expect(articleChannelName(42)).toBe('article:42');
    expect(articleChannelName('42')).toBe('article:42');
  });

  it('exposes the three event names', () => {
    expect(ABLY_EVENTS).toEqual({ content: 'content', caret: 'caret', comment: 'comment' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/ablyChannel.test.ts --ci`
Expected: FAIL with "Cannot find module '../../lib/ably/channel'".

- [ ] **Step 3: Write minimal implementation**

Create `lib/ably/channel.ts`:

```typescript
// Shared by both server (publish) and client (subscribe). NO Ably import here —
// keep it dependency-free so it can be imported anywhere (incl. the browser bundle).

/** One Ably channel per article carries all three realtime streams. */
export function articleChannelName(articleId: string | number): string {
  return `article:${articleId}`;
}

/** Event names published on the article channel. */
export const ABLY_EVENTS = {
  content: 'content',
  caret: 'caret',
  comment: 'comment',
} as const;

export type AblyEventName = typeof ABLY_EVENTS[keyof typeof ABLY_EVENTS];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/ablyChannel.test.ts --ci`
Expected: PASS (2 tests).

- [ ] **Step 5: Install the Ably SDK**

Run: `cd "C:/Users/patry/Desktop/serpbear" && npm install ably@^2`
Expected: `ably` appears in `package.json` `dependencies` (v2.x). The `ably/react` hooks ship inside this same package — no separate install.

- [ ] **Step 6: Add the env var to `.env.example`**

Append to `.env.example` (after the existing keys, following the `UPPERCASE_SNAKE` convention):

```
ABLY_API_KEY=
```

- [ ] **Step 7: Commit**

```bash
git add lib/ably/channel.ts __tests__/lib/ablyChannel.test.ts package.json package-lock.json .env.example
git commit -m "feat(realtime): add Ably channel helper, install SDK, env var

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Server publish helper (fire-and-forget, decoupled)

**Files:**
- Create: `lib/logger.ts`
- Create: `lib/ably/server.ts`
- Create: `__tests__/lib/ablyServer.test.ts`

The publish helper is the realization of the decoupling rule: it must NEVER throw into the caller, so a comment/content publish can sit next to a DB write without risking it.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/ablyServer.test.ts`:

```typescript
// Mock the ably module so no network happens.
const publishMock = jest.fn().mockResolvedValue(undefined);
const getMock = jest.fn(() => ({ publish: publishMock }));
const createTokenRequestMock = jest.fn().mockResolvedValue({ keyName: 'k', mac: 'm' });

jest.mock('ably', () => ({
  Rest: jest.fn().mockImplementation(() => ({
    channels: { get: getMock },
    auth: { createTokenRequest: createTokenRequestMock },
  })),
}));

describe('lib/ably/server', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    publishMock.mockClear();
    getMock.mockClear();
    process.env = { ...OLD_ENV, ABLY_API_KEY: 'app.key:secret' };
  });
  afterAll(() => { process.env = OLD_ENV; });

  it('publishes to the article channel with the right event name', async () => {
    const { publishToArticle } = require('../../lib/ably/server');
    await publishToArticle(7, 'comment', { type: 'create', commentId: 'c_1' });
    expect(getMock).toHaveBeenCalledWith('article:7');
    expect(publishMock).toHaveBeenCalledWith('comment', { type: 'create', commentId: 'c_1' });
  });

  it('swallows publish errors (never throws into the caller)', async () => {
    publishMock.mockRejectedValueOnce(new Error('ably down'));
    const { publishToArticle } = require('../../lib/ably/server');
    await expect(publishToArticle(7, 'content', { html: 'x' })).resolves.toBeUndefined();
  });

  it('no-ops (no throw) when ABLY_API_KEY is unset', async () => {
    process.env = { ...OLD_ENV };
    delete process.env.ABLY_API_KEY;
    const { publishToArticle } = require('../../lib/ably/server');
    await expect(publishToArticle(7, 'content', { html: 'x' })).resolves.toBeUndefined();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('mints a capability-scoped token request', async () => {
    const { mintArticleToken } = require('../../lib/ably/server');
    await mintArticleToken({ articleId: 7, kind: 'owner', clientId: 'owner:u1' });
    expect(createTokenRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'owner:u1',
      capability: JSON.stringify({ 'article:7': ['publish', 'subscribe', 'presence'] }),
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/ablyServer.test.ts --ci`
Expected: FAIL with "Cannot find module '../../lib/ably/server'".

- [ ] **Step 3: Create the logging facade**

Create `lib/logger.ts`:

```typescript
// Thin logging facade. Today it delegates to console; swapping in Sentry / Logtail /
// Datadog later is a ONE-file change instead of a codebase-wide console.* find-replace.
type Fields = Record<string, unknown>;
const fmt = (msg: string, fields?: Fields) => (fields ? `${msg} ${JSON.stringify(fields)}` : msg);

export const logger = {
  info: (msg: string, fields?: Fields) => console.info(fmt(msg, fields)),
  warn: (msg: string, fields?: Fields) => console.warn(fmt(msg, fields)),
  error: (msg: string, fields?: Fields) => console.error(fmt(msg, fields)),
};
```

- [ ] **Step 4: Write the server helper**

Create `lib/ably/server.ts`:

```typescript
import * as Ably from 'ably';
import { articleChannelName, AblyEventName } from './channel';
import { getErrorMessage } from '../errors';
import { logger } from '../logger';

// Singleton REST client (token minting + server-side publish). Pinned on globalThis
// so Next.js hot-reload / serverless warm reuse doesn't create a client per call.
const g = globalThis as unknown as { __ablyRest?: Ably.Rest | null };

function getAblyRest(): Ably.Rest | null {
  if (g.__ablyRest !== undefined) return g.__ablyRest;
  const key = process.env.ABLY_API_KEY;
  g.__ablyRest = key ? new Ably.Rest({ key }) : null;
  return g.__ablyRest;
}

/**
 * Fire-and-forget publish to an article's realtime channel.
 * NEVER throws — a realtime hiccup must not break the DB write it sits next to.
 * No-ops silently if ABLY_API_KEY is not configured (local/dev without Ably).
 */
export async function publishToArticle(
  articleId: string | number,
  event: AblyEventName,
  data: unknown,
): Promise<void> {
  try {
    const rest = getAblyRest();
    if (!rest) return;
    await rest.channels.get(articleChannelName(articleId)).publish(event, data);
  } catch (err) {
    // Decoupled by design: log and move on. The caller's DB write already succeeded.
    logger.warn('[ably] publish failed', { articleId, event, error: getErrorMessage(err) });
  }
}

export type AblyAccessKind = 'owner' | 'token';

function capabilityFor(articleId: string | number, kind: AblyAccessKind): string {
  const ch = articleChannelName(articleId);
  const ops = kind === 'owner'
    ? ['publish', 'subscribe', 'presence']   // owner is the sole publisher
    : ['subscribe', 'presence'];             // viewers watch + can appear in presence
  return JSON.stringify({ [ch]: ops });
}

/** Mint a short-lived, capability-scoped Ably TokenRequest for the client SDK. */
export async function mintArticleToken(opts: {
  articleId: string | number;
  kind: AblyAccessKind;
  clientId: string;
}): Promise<Ably.TokenRequest> {
  const rest = getAblyRest();
  if (!rest) throw new Error('ABLY_API_KEY not configured');
  return rest.auth.createTokenRequest({
    clientId: opts.clientId,
    capability: capabilityFor(opts.articleId, opts.kind),
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/lib/ablyServer.test.ts --ci`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/logger.ts lib/ably/server.ts __tests__/lib/ablyServer.test.ts
git commit -m "feat(realtime): Ably server helper — decoupled publish + token minting + logger facade

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Capability-scoped token endpoint

**Files:**
- Create: `pages/api/ably-token.ts`
- Create: `__tests__/api/ably-token.test.ts`

Reuses the existing `getCommentAccessKind(req, res, articleId)` (`lib/commentAccess.ts`) which already resolves owner-session vs share-token-holder from `req.query.token` + the session cookie.

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/ably-token.test.ts`:

```typescript
jest.mock('../../lib/commentAccess', () => ({ getCommentAccessKind: jest.fn() }));
jest.mock('../../lib/ably/server', () => ({ mintArticleToken: jest.fn() }));

import handler from '../../pages/api/ably-token';
import { getCommentAccessKind } from '../../lib/commentAccess';
import { mintArticleToken } from '../../lib/ably/server';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  return res;
}

describe('GET /api/ably-token', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a missing/invalid articleId with 400', async () => {
    const res = mockRes();
    await handler({ method: 'GET', query: {} } as any, res);
    expect(res.statusCode).toBe(400);
  });

  it('403s when the caller has no access', async () => {
    (getCommentAccessKind as jest.Mock).mockResolvedValue(null);
    const res = mockRes();
    await handler({ method: 'GET', query: { articleId: '5' } } as any, res);
    expect(res.statusCode).toBe(403);
  });

  it('mints an owner token with an owner clientId', async () => {
    (getCommentAccessKind as jest.Mock).mockResolvedValue('owner');
    (mintArticleToken as jest.Mock).mockResolvedValue({ keyName: 'k', mac: 'm' });
    const res = mockRes();
    await handler({ method: 'GET', query: { articleId: '5' } } as any, res);
    expect(mintArticleToken).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: 5, kind: 'owner' }),
    );
    expect((mintArticleToken as jest.Mock).mock.calls[0][0].clientId).toMatch(/^owner:/);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ keyName: 'k', mac: 'm' });
  });

  it('mints a viewer token with a sanitized guest clientId', async () => {
    (getCommentAccessKind as jest.Mock).mockResolvedValue('token');
    (mintArticleToken as jest.Mock).mockResolvedValue({ keyName: 'k', mac: 'm' });
    const res = mockRes();
    await handler({ method: 'GET', query: { articleId: '5', token: 'abc', clientId: 'Joe <x>' } } as any, res);
    const arg = (mintArticleToken as jest.Mock).mock.calls[0][0];
    expect(arg.kind).toBe('token');
    expect(arg.clientId).toBe('guest:Joe x'); // angle brackets stripped
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/ably-token.test.ts --ci`
Expected: FAIL with "Cannot find module '../../pages/api/ably-token'".

- [ ] **Step 3: Write minimal implementation**

Create `pages/api/ably-token.ts`:

```typescript
// GET /api/ably-token?articleId=&token=&clientId=
// Mints a capability-scoped Ably TokenRequest for the article's realtime channel.
// Owner (session) → publish+subscribe+presence. Share-token viewer → subscribe+presence.
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCommentAccessKind } from '../../lib/commentAccess';
import { mintArticleToken } from '../../lib/ably/server';
import { getCurrentUserId } from '../../utils/getUser';
import { getErrorMessage } from '../../lib/errors';

function sanitizeClientId(raw: unknown): string {
  if (typeof raw !== 'string') return 'guest';
  // Ably clientIds must be printable; strip control + angle brackets, cap length.
  const cleaned = raw.replace(/[<> -]/g, '').trim().slice(0, 64);
  return cleaned || 'guest';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const articleId = parseInt(String(req.query.articleId ?? ''), 10);
  if (!Number.isInteger(articleId)) return res.status(400).json({ error: 'articleId is required' });

  try {
    const kind = await getCommentAccessKind(req, res, articleId);
    if (!kind) return res.status(403).json({ error: 'Access denied.' });

    let clientId: string;
    if (kind === 'owner') {
      const uid = await getCurrentUserId(req, res);
      clientId = `owner:${uid ?? 'unknown'}`;
    } else {
      clientId = `guest:${sanitizeClientId(req.query.clientId)}`;
    }

    const tokenRequest = await mintArticleToken({ articleId, kind, clientId });
    // Returned verbatim to the Ably client SDK (authUrl expects a TokenRequest JSON).
    return res.status(200).json(tokenRequest);
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) || 'Token error' });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api/ably-token.test.ts --ci`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add pages/api/ably-token.ts __tests__/api/ably-token.test.ts
git commit -m "feat(realtime): /api/ably-token capability-scoped endpoint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Comments API publishes `comment` events to Ably

**Files:**
- Modify: `pages/api/articles/[id]/comments.ts` (after each `emitCommentChange`, lines ~107/135/146)
- Create: `__tests__/api/comments-publish.test.ts`

We ADD an Ably publish next to each existing `emitCommentChange` (kept as a harmless fallback). Because `publishToArticle` never throws, the comment mutation is unaffected if Ably is down.

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/comments-publish.test.ts`:

```typescript
// Verify the comments handler publishes a 'comment' event after a create.
jest.mock('../../lib/ably/server', () => ({ publishToArticle: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/commentAccess', () => ({
  getCommentAccessKind: jest.fn().mockResolvedValue('owner'),
  isOwnerComment: jest.fn().mockResolvedValue(false),
}));
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { sync: jest.fn().mockResolvedValue(undefined), query: jest.fn().mockResolvedValue([[], {}]) },
}));
jest.mock('../../lib/ensureArticlesTables', () => ({ ensureArticlesTables: jest.fn().mockResolvedValue(undefined) }));

import handler from '../../pages/api/articles/[id]/comments';
import { publishToArticle } from '../../lib/ably/server';

function mockRes() {
  const res: any = { statusCode: 200 };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  return res;
}

it('publishes a comment:create event to Ably after a successful POST', async () => {
  const res = mockRes();
  await handler({
    method: 'POST', query: { id: '9' },
    body: { quote: 'q', text: 'hello', author: 'Joe', color: '#783AFB' },
  } as any, res);
  expect(res.statusCode).toBe(200);
  expect(publishToArticle).toHaveBeenCalledWith('9', 'comment', expect.objectContaining({ type: 'create' }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/comments-publish.test.ts --ci`
Expected: FAIL — `publishToArticle` not called (the handler doesn't publish to Ably yet).

- [ ] **Step 3: Add the import + three publish calls**

In `pages/api/articles/[id]/comments.ts`, add near the other `lib/` imports at the top:

```typescript
import { publishToArticle } from '../../../../lib/ably/server';
import { ABLY_EVENTS } from '../../../../lib/ably/channel';
```

Then immediately AFTER each existing `emitCommentChange(...)` call, add the matching Ably publish:

After the `create` emit (~line 107):
```typescript
   emitCommentChange(String(id), { type: 'create', commentId, parentId });
   void publishToArticle(String(id), ABLY_EVENTS.comment, { type: 'create', commentId, parentId });
```

After the `update` emit (~line 135):
```typescript
   emitCommentChange(String(id), { type: 'update', commentId });
   void publishToArticle(String(id), ABLY_EVENTS.comment, { type: 'update', commentId });
```

After the `delete` emit (~line 146):
```typescript
   emitCommentChange(String(id), { type: 'delete', commentId });
   void publishToArticle(String(id), ABLY_EVENTS.comment, { type: 'delete', commentId: String(commentId) });
```

(`void` makes the fire-and-forget explicit; we don't await — the response returns immediately.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api/comments-publish.test.ts --ci`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add "pages/api/articles/[id]/comments.ts" __tests__/api/comments-publish.test.ts
git commit -m "feat(realtime): publish comment events to Ably on create/update/delete

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Client channel hook

**Files:**
- Create: `lib/ably/useArticleChannel.ts`

A single hook both pages use to get a subscribed channel. It builds an `Ably.Realtime` authenticated via `/api/ably-token`, returns the channel + a connection-state string, fires `onReconnect` after a dropped connection is restored (so the viewer can resync), and tears everything down on unmount. If `articleId` is null it stays idle (returns a null channel). The return type is an object `{ channel, connectionState }` — existing callers destructure `channel`.

- [ ] **Step 1: Create the hook** (no unit test — thin wrapper over the SDK + React; verified manually in later tasks)

Create `lib/ably/useArticleChannel.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import * as Ably from 'ably';
import { articleChannelName } from './channel';

type Params = {
  articleId: string | number | null | undefined;
  /** Share token for viewers; omit for the owner (session-authed). */
  shareToken?: string | null;
  /** Display name → becomes the Ably clientId (for presence/caret identity). */
  clientId?: string | null;
  /** Fired after a DROPPED connection is restored (not on the first connect).
   *  The viewer uses this to refetch the latest doc and resync. */
  onReconnect?: () => void;
};

export type UseArticleChannel = {
  channel: Ably.RealtimeChannel | null;
  connectionState: Ably.ConnectionState | 'idle';
};

/**
 * Returns a live Ably channel for the article (or null while idle), plus the live
 * connection state for UX (toast). One Realtime connection per mount; authed by
 * /api/ably-token (capability-scoped). Resync is the caller's job via onReconnect.
 */
export function useArticleChannel({ articleId, shareToken, clientId, onReconnect }: Params): UseArticleChannel {
  const [channel, setChannel] = useState<Ably.RealtimeChannel | null>(null);
  const [connectionState, setConnectionState] = useState<Ably.ConnectionState | 'idle'>('idle');
  const clientRef = useRef<Ably.Realtime | null>(null);
  // Keep the latest onReconnect without re-creating the connection on each render.
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => { onReconnectRef.current = onReconnect; }, [onReconnect]);

  useEffect(() => {
    if (articleId == null) return undefined;

    const authParams: Record<string, string> = { articleId: String(articleId) };
    if (shareToken) authParams.token = shareToken;
    if (clientId) authParams.clientId = clientId;

    const client = new Ably.Realtime({
      authUrl: '/api/ably-token',
      authMethod: 'GET',
      authParams,
      closeOnUnload: true,
    });
    clientRef.current = client;

    let hasConnectedOnce = false;
    const onState = (change: Ably.ConnectionStateChange) => {
      setConnectionState(change.current);
      if (change.current === 'connected') {
        if (hasConnectedOnce) onReconnectRef.current?.(); // a RE-connect → resync
        hasConnectedOnce = true;
      }
    };
    client.connection.on(onState);

    const ch = client.channels.get(articleChannelName(articleId));
    setChannel(ch);

    return () => {
      setChannel(null);
      setConnectionState('idle');
      try { client.connection.off(onState); } catch { /* ignore */ }
      try { ch.detach(); } catch { /* ignore */ }
      try { client.close(); } catch { /* ignore */ }
      clientRef.current = null;
    };
  }, [articleId, shareToken, clientId]);

  return { channel, connectionState };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ably/useArticleChannel.ts
git commit -m "feat(realtime): useArticleChannel client hook (authUrl-bound Realtime)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Wire live comments into CommentsLayer (viewer) + editor page

**Files:**
- Modify: `components/articles/comments/CommentsLayer.tsx` (replace the EventSource block, ~lines 85–93)
- Modify: `pages/articles/[id]/index.tsx` (owner editor subscribes to `comment` → bump `commentsVersion`)

The existing EventSource bumps a version counter that triggers `reload()`. We do the same from an Ably subscription instead.

- [ ] **Step 1: Replace the EventSource in CommentsLayer**

In `components/articles/comments/CommentsLayer.tsx`, add at the top with the other imports:

```typescript
import { useArticleChannel } from '../../../lib/ably/useArticleChannel';
import { ABLY_EVENTS } from '../../../lib/ably/channel';
```

Replace the existing SSE effect (the `new EventSource(...)` block, ~lines 85–93) with:

```typescript
  // Live comment sync via Ably (replaces the in-process SSE, which is dead on
  // serverless). Any comment event → bump the version → reload() refetches.
  const { channel: liveChannel } = useArticleChannel({
    articleId: article?.id ?? null,
    shareToken: typeof token === 'string' ? token : null,
    clientId: author?.name || null,
  });
  useEffect(() => {
    if (!liveChannel) return undefined;
    const onComment = () => setCommentsVersion((v) => v + 1);
    liveChannel.subscribe(ABLY_EVENTS.comment, onComment);
    return () => { liveChannel.unsubscribe(ABLY_EVENTS.comment, onComment); };
  }, [liveChannel]);
```

(Keep the existing `commentsVersion` state and `reload()` wiring exactly as-is — only the transport changes. `author` and `token` are already in scope per the recon report.)

- [ ] **Step 2: Subscribe the owner editor to comment events**

In `pages/articles/[id]/index.tsx`, add with the other `lib/` imports (3 levels up):

```typescript
import { useArticleChannel } from '../../../lib/ably/useArticleChannel';
import { ABLY_EVENTS } from '../../../lib/ably/channel';
```

Near the existing `commentsVersion` state (the page already has `setCommentsVersion`), add:

```typescript
  // Owner watches the same channel so reviewer comments appear live in the editor.
  const { channel: ownerChannel } = useArticleChannel({ articleId: article?.id ?? null });
  useEffect(() => {
    if (!ownerChannel) return undefined;
    const onComment = () => setCommentsVersion((v) => v + 1);
    ownerChannel.subscribe(ABLY_EVENTS.comment, onComment);
    return () => { ownerChannel.unsubscribe(ABLY_EVENTS.comment, onComment); };
  }, [ownerChannel]);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Set `ABLY_API_KEY` in `.env.local` (NOT `.env`). Run `npm run dev:next`. Open the editor (`/articles/{id}`) in one browser and the share viewer (`/drafts/s/{token}`) in another (or incognito). Post a comment as the reviewer.
Expected: the comment appears in the **owner's** editor within ~1s without a manual refresh; resolving/deleting a comment as the owner reflects on the viewer within ~1s.

- [ ] **Step 5: Commit**

```bash
git add components/articles/comments/CommentsLayer.tsx "pages/articles/[id]/index.tsx"
git commit -m "feat(realtime): live comments via Ably on viewer + editor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Throttle helper

**Files:**
- Create: `lib/throttle.ts`
- Create: `__tests__/lib/throttle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/throttle.test.ts`:

```typescript
import { throttle } from '../../lib/throttle';

jest.useFakeTimers();

describe('throttle (trailing edge)', () => {
  it('fires immediately, then coalesces rapid calls into one trailing call', () => {
    const fn = jest.fn();
    const t = throttle(fn, 300);
    t('a'); // leading
    t('b');
    t('c'); // last wins for the trailing call
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('a');
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('cancel() drops a pending trailing call', () => {
    const fn = jest.fn();
    const t = throttle(fn, 300);
    t('a');
    t('b');
    t.cancel();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1); // only the leading call
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/throttle.test.ts --ci`
Expected: FAIL with "Cannot find module '../../lib/throttle'".

- [ ] **Step 3: Write minimal implementation**

Create `lib/throttle.ts`:

```typescript
/**
 * Trailing-edge throttle: fires immediately on the first call, then at most once
 * per `ms` window, always delivering the most recent args at the trailing edge.
 * Used to cap Ably publish rate for content/caret while typing.
 */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;

  const invoke = (args: A) => { last = Date.now(); fn(...args); };

  const throttled = (...args: A) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      invoke(args);
    } else {
      pending = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          if (pending) { const p = pending; pending = null; invoke(p); }
        }, remaining);
      }
    }
  };

  throttled.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    pending = null;
  };

  return throttled;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/throttle.test.ts --ci`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/throttle.ts __tests__/lib/throttle.test.ts
git commit -m "feat(realtime): trailing-edge throttle util for publish rate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Owner publishes throttled content + caret

**Files:**
- Modify: `pages/articles/[id]/index.tsx`

The page already has `editorHtml` (current HTML) and `handleEditorChange`. We publish `content` on change (throttled ~300ms) and `caret` from the live editor selection (throttled ~120ms). Both are best-effort; a publish failure is invisible to the owner and never blocks autosave.

Ably's per-message size cap is 64 KB on standard plans. For large drafts we skip the inline broadcast and tell the viewer to refetch from `/api/share` instead (correctness preserved).

- [ ] **Step 1: Add imports + throttled publishers**

In `pages/articles/[id]/index.tsx`, with the other imports:

```typescript
import { throttle } from '../../../lib/throttle';
// (useArticleChannel + ABLY_EVENTS already imported in Task 6 as `ownerChannel`.)
```

After the `ownerChannel` declaration (Task 6), add a stable throttled content publisher and a guard constant:

```typescript
  // Ably caps a single message at ~64KB; above this we signal a refetch instead of
  // shipping the whole document inline (rare for drafts, but keeps viewers correct).
  const MAX_LIVE_HTML = 56 * 1024;

  const publishContent = useRef(
    throttle((html: string) => {
      if (!ownerChannel) return;
      if (html.length > MAX_LIVE_HTML) {
        void ownerChannel.publish(ABLY_EVENTS.content, { tooLarge: true });
      } else {
        void ownerChannel.publish(ABLY_EVENTS.content, { html });
      }
    }, 300),
  );
  // Keep the throttled closure pointing at the latest channel without re-creating it.
  useEffect(() => { /* channel captured via ownerChannel ref below */ }, [ownerChannel]);
```

Because `throttle` captures `ownerChannel` at creation, store the channel in a ref the closure reads. Use this ref-based version, which also stamps every event with a monotonic `rev` so the viewer can order content vs caret (they have different throttle windows):

```typescript
  const MAX_LIVE_HTML = 56 * 1024;
  const ownerChannelRef = useRef<typeof ownerChannel>(null);
  useEffect(() => { ownerChannelRef.current = ownerChannel; }, [ownerChannel]);

  // Monotonic revision: bumped on every content change; caret events carry the rev
  // of the doc they were measured against so the viewer never draws a stale caret.
  const contentRevRef = useRef(0);

  const publishContentRef = useRef(
    throttle((html: string, rev: number) => {
      const ch = ownerChannelRef.current;
      if (!ch) return;
      if (html.length > MAX_LIVE_HTML) void ch.publish(ABLY_EVENTS.content, { tooLarge: true, rev });
      else void ch.publish(ABLY_EVENTS.content, { html, rev });
    }, 500),
  );

  // Caret is throttled tighter than content: it's a tiny payload and wants to feel
  // smooth (75ms ≈ 13fps), whereas content is heavy and 500ms is plenty.
  const publishCaretRef = useRef(
    throttle((from: number, to: number, rev: number) => {
      const ch = ownerChannelRef.current;
      if (ch) void ch.publish(ABLY_EVENTS.caret, { from, to, rev });
    }, 75),
  );
```

- [ ] **Step 2: Publish content from the change handler**

The page's `handleEditorChange` (recon: lines ~603–612) sets `editorHtml`. Add one line inside it so each real edit broadcasts:

```typescript
  const handleEditorChange = useCallback(
    (html: string, text: string, words: number, headings: number, paragraphs: number) => {
      setEditorHtml(html);
      setPlainText(text);
      setWordCount(words);
      setHeadingCount(headings);
      setParagraphCount(paragraphs);
      contentRevRef.current += 1; // new doc revision
      publishContentRef.current(html, contentRevRef.current); // live mirror (throttled, best-effort)
    },
    [],
  );
```

- [ ] **Step 3: Publish caret from editor selection**

The editor instance is reachable via `editorRef.current?.getEditor()` (recon: ArticleEditor exposes `getEditor`). Add an effect that listens to selection changes and publishes `from/to`:

```typescript
  useEffect(() => {
    const ed = editorRef.current?.getEditor?.();
    if (!ed) return undefined;
    const onSel = () => {
      const { from, to } = ed.state.selection;
      publishCaretRef.current(from, to, contentRevRef.current); // tag with current doc rev
    };
    ed.on('selectionUpdate', onSel);
    return () => { ed.off('selectionUpdate', onSel); };
    // Re-bind once the editor instance exists (article load completes).
  }, [article?.id]);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (If `editorRef.current.getEditor` is typed `any`, that's consistent with the existing `editorRef` shape in the recon.)

- [ ] **Step 5: Manual verification (paired with Task 9's viewer side)**

Cannot fully verify until the viewer renders content (Task 9). For now confirm in the browser devtools Network tab that the editor opens a WebSocket to Ably and that typing emits `content`/`caret` frames (throttled, not per-keystroke).

- [ ] **Step 6: Commit**

```bash
git add "pages/articles/[id]/index.tsx"
git commit -m "feat(realtime): owner publishes throttled content + caret

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Read-only viewer editor (content render + caret target)

**Files:**
- Create: `components/articles/ViewerEditor.tsx`

A read-only Tiptap editor that (a) renders the article, (b) gives us a ProseMirror doc whose positions match the owner's so `coordsAtPos` works, and (c) sanitizes by schema-parse (unknown nodes/`on*`/`<script>` are dropped). Extensions mirror the author's CONTENT nodes/marks only (no SlashCommand/Surfy/comment-highlight — those are authoring-only).

- [ ] **Step 1: Create the component**

Create `components/articles/ViewerEditor.tsx`:

```typescript
import { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import { TableKit } from '@tiptap/extension-table';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details';
import Youtube from '@tiptap/extension-youtube';
import { SurferImage } from './SurferImageNode';

export type ViewerEditorHandle = {
  /** Replace the rendered doc with new HTML (no history, no events). */
  setContent: (html: string) => void;
  /** Screen coords of a ProseMirror position, for the ghost caret. */
  coordsAtPos: (pos: number) => { left: number; top: number; bottom: number } | null;
  /** Current doc size, to clamp incoming caret positions. */
  docSize: () => number;
};

type Props = { initialHtml: string };

/**
 * Read-only mirror of the author's editor. Uses the same CONTENT extensions so the
 * doc (and thus ProseMirror positions) round-trip; interactive authoring extensions
 * are intentionally omitted. Parsing untrusted HTML through the schema also strips
 * scripts / event handlers / unknown nodes — sanitization for free.
 */
const ViewerEditor = forwardRef<ViewerEditorHandle, Props>(({ initialHtml }, ref) => {
  const editor = useEditor({
    editable: false,
    immediatelyRender: false,
    content: initialHtml,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, link: false }),
      SurferImage.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'article-image' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Highlight.configure({ multicolor: true }),
      TableKit.configure({ table: { resizable: false } }),
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Subscript,
      Superscript,
      TextStyle,
      Color,
      Details.configure({ persist: true, HTMLAttributes: { class: 'art-details' } }),
      DetailsSummary,
      DetailsContent,
      Youtube.configure({ width: 640, height: 360, nocookie: true, HTMLAttributes: { class: 'art-youtube' } }),
    ],
  });

  useImperativeHandle(ref, () => ({
    setContent: (html: string) => {
      if (!editor) return;
      // Preserve scroll across the doc swap so the viewer doesn't jump/flicker when
      // content above the fold changes height. emitUpdate:false → no events/history.
      const scrollEl = document.scrollingElement || document.documentElement;
      const prevTop = scrollEl.scrollTop;
      editor.commands.setContent(html, { emitUpdate: false });
      requestAnimationFrame(() => { scrollEl.scrollTop = prevTop; });
    },
    coordsAtPos: (pos: number) => {
      if (!editor) return null;
      try {
        const clamped = Math.max(0, Math.min(pos, editor.state.doc.content.size));
        const c = editor.view.coordsAtPos(clamped);
        return { left: c.left, top: c.top, bottom: c.bottom };
      } catch { return null; }
    },
    docSize: () => editor?.state.doc.content.size ?? 0,
  }), [editor]);

  // Keep mounted content in sync if the parent swaps initialHtml (e.g. refetch).
  useEffect(() => {
    if (editor && initialHtml && editor.getHTML() !== initialHtml) {
      editor.commands.setContent(initialHtml, { emitUpdate: false });
    }
  }, [initialHtml, editor]);

  return <EditorContent editor={editor} className="preview-prose" />;
});

ViewerEditor.displayName = 'ViewerEditor';
export default ViewerEditor;
```

> Note: this imports `SurferImage` from the existing `./SurferImageNode`. If that module's export name differs, match the import the author editor uses (`components/articles/ArticleEditor.tsx` line ~import block). The other `@tiptap/extension-*` packages are already dependencies (the author editor imports them).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. If a `@tiptap/extension-*` import path differs from what `ArticleEditor.tsx` uses, copy the exact import line from there.

- [ ] **Step 3: Commit**

```bash
git add components/articles/ViewerEditor.tsx
git commit -m "feat(realtime): read-only ViewerEditor (render + caret map + schema sanitize)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Viewer subscribes to content + caret + draws ghost caret

**Files:**
- Modify: `pages/drafts/s/[token].tsx`

Swap the `dangerouslySetInnerHTML` block for `<ViewerEditor>`, subscribe to `content`/`caret`, apply content on receipt, and position a ghost caret element from `coordsAtPos`. On a `tooLarge` content signal, refetch from `/api/share`.

**Bootstrap order (must be explicit):** `GET /api/share/{token}` → render `ViewerEditor` with that content → `useArticleChannel` connects to Ably → `presence.enter()` → `subscribe(content/caret)`. The initial GET is the baseline; realtime events only ever move forward from it (the `rev` guard drops anything older). This ordering guarantees the viewer is never blank-then-flashing and never applies an event against an unrendered doc. In code this falls out naturally: the existing fetch effect runs first; `useArticleChannel` only returns a channel after the article id is known; presence/subscribe live in the channel effect.

- [ ] **Step 1: Add imports + refs + state**

In `pages/drafts/s/[token].tsx`, ensure `useRef`, `useState`, `useEffect`, and `useCallback` are in the React import (add any that are missing), then add:

```typescript
import ViewerEditor, { ViewerEditorHandle } from '../../../components/articles/ViewerEditor';
import { useArticleChannel } from '../../../lib/ably/useArticleChannel';
import { ABLY_EVENTS } from '../../../lib/ably/channel';
```

Inside the component, add:

```typescript
  const viewerRef = useRef<ViewerEditorHandle>(null);
  const [caretBox, setCaretBox] = useState<{ left: number; top: number; height: number } | null>(null);
  // Revision bookkeeping so a caret is never drawn against a doc we haven't rendered.
  const renderedRevRef = useRef(0);
  const pendingCaretRef = useRef<{ from: number; rev: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);      // "editing…" indicator
  const editingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resync helper: pull the latest doc from the source of truth (used on reconnect
  // and on a tooLarge signal). Restores correctness after any missed events.
  const resyncFromShare = useCallback(() => {
    fetch(`/api/share/${token}`).then((r) => r.json())
      .then((j) => { if (j?.article?.content) viewerRef.current?.setContent(j.article.content); })
      .catch(() => {});
  }, [token]);

  const drawCaret = useCallback((from: number) => {
    const box = viewerRef.current?.coordsAtPos(from);
    if (box) setCaretBox({ left: box.left, top: box.top, height: box.bottom - box.top });
  }, []);
```

- [ ] **Step 2: Replace the content render with ViewerEditor**

Replace the read-only `contentEditable` + `dangerouslySetInnerHTML` block (recon: ~lines 166–179) with:

```typescript
        <div style={{ position: 'relative' }}>
          <ViewerEditor ref={viewerRef} initialHtml={article.content || ''} />
          {caretBox && (
            <span
              aria-hidden
              style={{
                position: 'fixed',
                left: caretBox.left,
                top: caretBox.top,
                height: caretBox.height,
                width: 2,
                background: '#783AFB',
                pointerEvents: 'none',
                animation: 'art-caret-blink 1s step-end infinite',
                zIndex: 50,
              }}
            />
          )}
        </div>
```

Add the blink keyframes to the page's existing `<style jsx>` (or the nearest style block):

```css
        @keyframes art-caret-blink { 50% { opacity: 0; } }
```

- [ ] **Step 2b: Connection + activity indicators**

Add a small fixed status strip (place it near the top of the returned JSX, after the opening container). It reuses `connectionState` from Step 3 and `isEditing` from Step 1:

```typescript
        {connectionState && connectionState !== 'connected' && connectionState !== 'idle' && (
          <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 60, padding: '6px 12px',
            borderRadius: 8, background: '#1f2937', color: '#fff', fontSize: 13 }}>
            {connectionState === 'connecting' || connectionState === 'disconnected'
              ? 'Reconnecting…'
              : connectionState === 'suspended' ? 'Offline — retrying…' : 'Connecting…'}
          </div>
        )}
        {isEditing && (
          <div style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 60, padding: '4px 10px',
            borderRadius: 999, background: 'rgba(120,58,251,0.12)', color: '#783AFB', fontSize: 12 }}>
            ✏️ editing…
          </div>
        )}
```

- [ ] **Step 3: Subscribe to content + caret**

Add the channel + subscription effect (the page already fetches `article` and has `token`; `resyncFromShare`/`drawCaret` come from Step 1):

```typescript
  const { channel: liveChannel, connectionState } = useArticleChannel({
    articleId: article?.id ?? null,
    shareToken: typeof token === 'string' ? token : null,
    clientId: authorName || null, // reuse the name-gate identity for presence
    onReconnect: resyncFromShare,  // dropped → restored: pull latest, don't trust gaps
  });

  useEffect(() => {
    if (!liveChannel) return undefined;

    const onContent = (msg: { data?: { html?: string; tooLarge?: boolean; rev?: number } }) => {
      const d = msg.data || {};
      const rev = typeof d.rev === 'number' ? d.rev : renderedRevRef.current + 1;
      // Drop stale / duplicate / out-of-order content (delayed messages, reconnect
      // races). tooLarge always refetches the source of truth, so let it through.
      if (!d.tooLarge && rev <= renderedRevRef.current) return;
      if (d.tooLarge) { resyncFromShare(); }
      else if (typeof d.html === 'string') { viewerRef.current?.setContent(d.html); }
      renderedRevRef.current = Math.max(renderedRevRef.current, rev);

      // "editing…" indicator: a content event means the owner is actively typing.
      setIsEditing(true);
      if (editingTimer.current) clearTimeout(editingTimer.current);
      editingTimer.current = setTimeout(() => setIsEditing(false), 2000);

      // If a caret was waiting for this doc revision, draw it now.
      const pc = pendingCaretRef.current;
      if (pc && pc.rev <= renderedRevRef.current) { pendingCaretRef.current = null; drawCaret(pc.from); }
    };

    const onCaret = (msg: { data?: { from?: number; rev?: number } }) => {
      const from = msg.data?.from;
      const rev = msg.data?.rev ?? 0;
      if (typeof from !== 'number') return;
      // Don't draw a caret against a doc we haven't rendered yet — stash until it lands.
      if (rev > renderedRevRef.current) { pendingCaretRef.current = { from, rev }; return; }
      drawCaret(from);
    };

    liveChannel.subscribe(ABLY_EVENTS.content, onContent);
    liveChannel.subscribe(ABLY_EVENTS.caret, onCaret);
    return () => {
      liveChannel.unsubscribe(ABLY_EVENTS.content, onContent);
      liveChannel.unsubscribe(ABLY_EVENTS.caret, onCaret);
    };
  }, [liveChannel, resyncFromShare, drawCaret]);
```

> The viewer page now has TWO `useArticleChannel` consumers if `CommentsLayer` (Task 6) is also mounted here — that's fine, each opens its own connection. If you prefer a single connection, lift `liveChannel` to the page and pass it into `CommentsLayer` as a prop; for v1 two connections is acceptable and simpler.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification (the full feature)**

`npm run dev:next` with `ABLY_API_KEY` set in `.env.local`. Owner edits in `/articles/{id}`; viewer watches `/drafts/s/{token}` in another browser.
Expected:
- Typing in the editor updates the viewer's rendered article within ~300ms.
- The owner's text cursor shows as a blinking purple ghost caret in the viewer, tracking position.
- Images/tables/headings/lists render correctly in the viewer (schema round-trips).
- A `<script>` pasted into the editor does NOT execute in the viewer (schema-parse drops it).
- Comments still sync live (Task 6) in both directions.

- [ ] **Step 6: Commit**

```bash
git add "pages/drafts/s/[token].tsx"
git commit -m "feat(realtime): viewer renders live content + ghost caret via Ably

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Presence — "who's viewing" + "editor live/away" (optional, small)

**Files:**
- Modify: `pages/drafts/s/[token].tsx` (viewer enters presence; detects owner → "editor live/away")
- Modify: `pages/articles/[id]/index.tsx` (owner enters presence; shows "N reviewing")

YAGNI gate: include only if the owner wants a "someone is reviewing" signal and viewers want a "editor is live" signal. Skip otherwise.

**Brutal-close behaviour:** Ably auto-fires a presence `leave` when a connection drops — but on a hard tab close (Ctrl+W) the realtime presence member lingers until Ably's presence timeout (~15 s) before the `leave` propagates. We rely on this; no manual heartbeat needed. The UI should treat "no owner present" as "away", which will resolve within that window.

- [ ] **Step 1: Both sides enter presence with a role**

In `pages/drafts/s/[token].tsx`, inside the live-channel effect (Task 10), after subscribing:

```typescript
    liveChannel.presence.enter({ name: authorName || 'Guest', role: 'viewer' }).catch(() => {});
```

In `pages/articles/[id]/index.tsx`, inside the owner-channel effect (Task 6), after subscribing:

```typescript
    ownerChannel.presence.enter({ role: 'owner' }).catch(() => {});
```

(`presence.leave` happens automatically on the connection close from `useArticleChannel`'s teardown.)

- [ ] **Step 2: Viewer shows "editor live / away"**

In `pages/drafts/s/[token].tsx`, add state + a presence subscription on `liveChannel`:

```typescript
  const [ownerLive, setOwnerLive] = useState(false);
  useEffect(() => {
    if (!liveChannel) return undefined;
    const refresh = () => liveChannel.presence.get()
      .then((members) => setOwnerLive(members.some((m) => (m.data as { role?: string })?.role === 'owner')))
      .catch(() => {});
    liveChannel.presence.subscribe(['enter', 'leave', 'update'], refresh);
    refresh();
    return () => { liveChannel.presence.unsubscribe(); };
  }, [liveChannel]);
```

Render near the status strip (Task 10 Step 2b): `<span>{ownerLive ? '🟢 editor live' : '⚫ editor away'}</span>`.

- [ ] **Step 3: Owner shows reviewer count**

In `pages/articles/[id]/index.tsx`, add state + a presence subscription on `ownerChannel`:

```typescript
  const [reviewers, setReviewers] = useState<string[]>([]);
  useEffect(() => {
    if (!ownerChannel) return undefined;
    const refresh = () => ownerChannel.presence.get()
      .then((members) => setReviewers(members
        .filter((m) => (m.data as { role?: string })?.role === 'viewer')
        .map((m) => ((m.data as { name?: string })?.name) || 'Guest')))
      .catch(() => {});
    ownerChannel.presence.subscribe(['enter', 'leave', 'update'], refresh);
    refresh();
    return () => { ownerChannel.presence.unsubscribe(); };
  }, [ownerChannel]);
```

Render `reviewers.length` wherever the editor shows status (e.g. near the autosave indicator): `{reviewers.length > 0 && <span>👀 {reviewers.length} reviewing</span>}`.

- [ ] **Step 4: Typecheck + manual verify**

Run: `npx tsc --noEmit` (no new errors). Open the viewer → owner shows "👀 1 reviewing" and the viewer shows "🟢 editor live"; close the editor tab → viewer flips to "⚫ editor away" within ~15 s (Ably presence timeout).

- [ ] **Step 5: Commit**

```bash
git add "pages/drafts/s/[token].tsx" "pages/articles/[id]/index.tsx"
git commit -m "feat(realtime): presence — reviewers count + editor live/away

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Full-suite verification + graphify

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:ci`
Expected: all suites pass, including the 5 new ones (`ablyChannel`, `ablyServer`, `throttle`, `ably-token`, `comments-publish`).

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `/api/ably-token`, `/articles/[id]`, `/drafts/s/[token]` all compile.

- [ ] **Step 4: End-to-end manual smoke (two browsers)**

With `ABLY_API_KEY` set: confirm live content, ghost caret, live comments (both directions), the >56KB `tooLarge` refetch path (paste a very long doc), and graceful behavior when `ABLY_API_KEY` is unset (no crash; autosave + initial render still work, just no live updates).

- [ ] **Step 5: Update the knowledge graph**

Run: `graphify update .`

- [ ] **Step 6: Update the realtime memory to "built"**

Edit `C:\Users\patry\.claude\projects\C--Users-patry\memory\serpbear-realtime-architecture.md`: change "NOT built yet" → "BUILT 2026-..." and note the channel/event design (`article:{id}` + content/caret/comment) and the ViewerEditor decision. Update the `MEMORY.md` index line accordingly.

---

## Self-Review

**1. Spec coverage (vs the architecture memory):**
- Token endpoint, capabilities, identified clients → Task 3 (+ `mintArticleToken` in Task 2). ✓
- Live comments (replace broken SSE) → Tasks 4 + 6. ✓
- Live content broadcast (throttled) → Tasks 7 + 8 (publish) + 9 + 10 (render). ✓
- Live editor caret → Tasks 8 (publish selection) + 9 (`coordsAtPos`) + 10 (ghost caret). ✓
- Autosave stays decoupled → publish helper swallows errors (Task 2); content publish is a separate best-effort line in `handleEditorChange` (Task 8), never gating `doSave`. ✓
- Presence "who's viewing" → Task 11 (optional). ✓
- Sanitization → free via ViewerEditor schema-parse (Task 9). ✓
- One channel, three events (simplification of the "3 channels" note) → consistently used in Tasks 1–10. ✓

**2. Placeholder scan:** No TBD/TODO; every code step has full code. The one judgment call (Task 9 `SurferImage` import name) has an explicit instruction to match `ArticleEditor.tsx`. ✓

**3. Type/name consistency:** `articleChannelName`, `ABLY_EVENTS.{content,caret,comment}`, `publishToArticle(id, event, data)`, `mintArticleToken({articleId,kind,clientId})`, `useArticleChannel({articleId,shareToken,clientId})`, `ViewerEditorHandle.{setContent,coordsAtPos,docSize}` — used identically across all tasks. ✓

**Known limitations (documented, not gaps):**
- **Full-HTML broadcast, capped at 56 KB** (review #1/#5): larger docs fall back to a `tooLarge` refetch signal (Task 8/10). **v2 (explicit roadmap item): broadcast ProseMirror transactions/steps instead of full HTML** — a single keystroke ships a few bytes, not the whole 70 KB doc; simpler here than CRDT because single-writer means no rebasing. Pair with optional `lz-string`/`CompressionStream` compression. Not worth the complexity below the 56 KB cap, which covers typical drafts. At 100 viewers × 70 KB × 2/s the full-HTML path is ~14 MB/s of fan-out — the throttle (500 ms) and cap mitigate it, but the step-based v2 is the real fix at scale.
- **Comment events are idempotent by construction** (review #3): the client never applies a comment event's payload — it bumps a counter that triggers a refetch of the comment list from the DB (source of truth). A duplicated/retransmitted comment event therefore causes at most one redundant refetch, never a doubled comment. No per-event dedup id needed. (Content events get explicit `rev` ordering instead — see Task 10.)
- **Stale/duplicate content events are dropped** (review #2): the viewer keeps `renderedRev` and ignores any `content`/`caret` whose `rev` is not newer (delayed messages, reconnect races). See Task 10 `onContent`.
- **Error observability is `console.warn`** (review #6): matches the current house style (the whole app logs to console). Wiring a real tracker (Sentry/Logtail/OpenTelemetry) is a cross-cutting infra decision for the whole app, not this feature — tracked separately. The publish helper logs `articleId` + event for diagnosis.
- **Reconnect resync = refetch `/api/share`** (review #7), not Ably `rewind`: chosen because the channel multiplexes content+caret+comment, so a blanket `rewind=N` would replay mixed event types; an explicit refetch of the source of truth is simpler and always correct.
- **Presence on hard tab-close lingers ~15 s** (review #4): Ably's presence timeout. The UI treats "no owner present" as "away" and resolves within that window; no custom heartbeat.
- Per-reviewer identity is the name-gate string (not a cryptographic per-reviewer token) — fine for presence/caret display; the reviewer-vs-reviewer comment IDOR remains a separate, pre-existing security task (see `serpbear-security-audit` memory).
- `commentBus`/SSE is left in place as a dead fallback; a later cleanup task can delete `lib/commentBus.ts` + `comments-stream.ts` once Ably is confirmed in production.

**Review-feedback traceability (v1.1):** #1 throttle→500 ms + cap (Task 8) · #2 scroll-preserving setContent (Task 9) · #3 `rev` ordering for content/caret (Tasks 8+10) · #4 owner+viewer presence, away state, timeout note (Task 11) · #5 compression deferred (above) · #6 logging stance (above) · #7 reconnect refetch (Tasks 5+10). Additions: sequence (#3 done), "editor away/Live ended" (Task 11), viewer count (Task 11), typing indicator (Task 10), reconnect toast (Task 10).

**Review-feedback traceability (v1.2):** #1 v2 ProseMirror-step roadmap made explicit + fan-out math (limitations) · #2 stale/dup content dropped via `renderedRev` guard (Task 10 `onContent`) · #3 comment idempotency documented as inherent to the refetch pattern (limitations) · #4 presence "away" latency quantified ~15 s (Task 11 brutal-close note) · #5 `lib/logger.ts` facade replaces raw `console.*` in the publish helper (Task 2) · #6 (same logger facade — one-file swap to Sentry/Datadog) · #7 caret throttle split to **75 ms** vs content 500 ms (Task 8) · explicit viewer bootstrap order (Task 10 intro).
```
