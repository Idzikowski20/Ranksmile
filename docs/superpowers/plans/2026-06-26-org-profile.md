# Organization Profile (②) Implementation Plan

> Sub-project ② of the workspace/org feature. Builds on ① (tenancy foundation) — uses `organizations` table + `lib/tenancy.ts`. Branch: `feature/tenancy-foundation`.

**Goal:** Make the Settings → Organization → General tab real: persist the org name + logo (logo uploaded to Cloudflare R2), wiring the existing `OrganizationGeneralSettings` stub to a new `/api/organization` endpoint.

**Architecture:** `organizations` table (from ①) already has `name` + `logo_url`. A `lib/organization.ts` resolves the caller's org via `ensureUserTenancy` and reads/writes those two fields. The logo arrives from the client as a base64 data URL, is decoded server-side and uploaded to R2 via a new `uploadImageBuffer` helper (sibling to the existing URL-based `uploadImageFromUrl`); the returned public URL is stored in `logo_url`. A react-query service feeds the settings component.

**Conventions:** `cd /c/Users/patry/Desktop/serpbear && ...` prefix (Bash cwd resets). Test: `npx jest <path> --ci`. Typecheck: `npx tsc --noEmit`. Tests mock the DB and AWS SDK locally; ALWAYS `jest.mock('sequelize', ...)` when a module pulls sequelize. UI: inline styles + design.md tokens (component already styled — wiring only). Commit specific files only; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `uploadImageBuffer` + `parseDataUrl` (`lib/uploadToBlob.ts`)

Add a buffer-based uploader (the existing `uploadImageFromUrl` only fetches a remote URL) and a data-URL parser. Reuse the existing `getClient`, `ALLOWED_MIME`, `MAX_BYTES`.

**Files:** Modify `lib/uploadToBlob.ts`; Test `__tests__/lib/uploadToBlob.test.ts`.

- [ ] **Step 1: Failing test** (`__tests__/lib/uploadToBlob.test.ts`):
```ts
import { parseDataUrl } from '../../lib/uploadToBlob';

describe('parseDataUrl', () => {
  it('decodes a valid base64 image data URL', () => {
    const png = Buffer.from('hello').toString('base64');
    const res = parseDataUrl(`data:image/png;base64,${png}`);
    expect(res).not.toBeNull();
    expect(res!.contentType).toBe('image/png');
    expect(res!.buffer.toString()).toBe('hello');
  });
  it('returns null for a non-data-url string', () => {
    expect(parseDataUrl('https://x.com/a.png')).toBeNull();
  });
  it('returns null for a non-image data URL', () => {
    expect(parseDataUrl('data:text/plain;base64,aGk=')).toBeNull();
  });
});
```
- [ ] **Step 2: Run → fail** (`parseDataUrl` not exported).
- [ ] **Step 3: Implement** — append to `lib/uploadToBlob.ts`:
```ts
/** Parses a `data:image/<type>;base64,<data>` URL into a buffer + content type. Null if invalid/not an image. */
export function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
   const m = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl || '');
   if (!m) return null;
   const contentType = m[1].trim().toLowerCase();
   if (!ALLOWED_MIME.includes(contentType)) return null;
   try {
      return { buffer: Buffer.from(m[2], 'base64'), contentType };
   } catch {
      return null;
   }
}

/** Uploads an in-memory image buffer to R2 under `keyPrefix/`. Returns the public URL or null. */
export async function uploadImageBuffer(
   buffer: Buffer,
   contentType: string,
   filename: string,
   keyPrefix = 'uploads',
): Promise<string | null> {
   const bucket = process.env.R2_BUCKET_NAME;
   const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
   if (!bucket || !publicUrl) {
      console.warn('[R2] R2_BUCKET_NAME or R2_PUBLIC_URL not set — skipping upload');
      return null;
   }
   const baseType = contentType.split(';')[0].trim().toLowerCase();
   if (!ALLOWED_MIME.includes(baseType)) { console.warn(`[R2] not an allowed image: ${baseType}`); return null; }
   if (buffer.byteLength > MAX_BYTES) { console.warn(`[R2] image too large: ${buffer.byteLength} bytes`); return null; }
   try {
      const ext = baseType.split('/')[1].replace('jpeg', 'jpg');
      const random = Math.random().toString(36).slice(2, 8);
      const key = `${keyPrefix}/${filename}-${random}.${ext}`;
      const client = getClient();
      await client.send(new PutObjectCommand({
         Bucket: bucket, Key: key, Body: buffer, ContentType: baseType,
         CacheControl: 'public, max-age=31536000',
      }));
      return `${publicUrl}/${key}`;
   } catch (err: any) {
      console.error('[R2] buffer upload error:', err?.message);
      return null;
   }
}
```
- [ ] **Step 4: Run → pass** (3/3). **Step 5:** tsc clean; commit `lib/uploadToBlob.ts __tests__/lib/uploadToBlob.test.ts` — `feat(org): R2 buffer upload + data-URL parser`.

---

### Task 2: `lib/organization.ts` read/write helpers

**Files:** Create `lib/organization.ts`; Test `__tests__/lib/organization.test.ts`.

- [ ] **Step 1: Failing test** (`__tests__/lib/organization.test.ts`):
```ts
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../lib/tenancy', () => ({ ensureUserTenancy: jest.fn().mockResolvedValue({ orgId: 5, defaultWorkspaceId: 9 }) }));

import db from '../../database/database';
import { readOrganization, writeOrganization } from '../../lib/organization';

const mockQuery = db.query as jest.Mock;
const rows = (r: unknown[]) => [r, {}];

describe('organization helpers', () => {
  beforeEach(() => mockQuery.mockReset());

  it('readOrganization returns name + logoUrl for the caller org', async () => {
    mockQuery.mockResolvedValueOnce(rows([{ name: 'Acme', logo_url: 'https://cdn/x.png' }]));
    expect(await readOrganization('u1')).toEqual({ name: 'Acme', logoUrl: 'https://cdn/x.png' });
    expect(String(mockQuery.mock.calls[0][0])).toContain('FROM organizations');
  });

  it('writeOrganization updates only provided fields and returns the fresh record', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([]))                                  // UPDATE
      .mockResolvedValueOnce(rows([{ name: 'New', logo_url: null }]));  // re-read
    const res = await writeOrganization('u1', { name: 'New' });
    expect(res).toEqual({ name: 'New', logoUrl: null });
    expect(String(mockQuery.mock.calls[0][0])).toContain('UPDATE organizations SET name = ?');
  });
});
```
- [ ] **Step 2: Run → fail.** **Step 3: Implement** `lib/organization.ts`:
```ts
import db from '../database/database';
import { ensureUserTenancy } from './tenancy';

export type OrganizationProfile = { name: string | null; logoUrl: string | null };
type Row = Record<string, any>;
async function select(sql: string, replacements: any[]): Promise<Row[]> {
   const [rows] = await db.query(sql, { replacements }) as [Row[], unknown];
   return rows;
}

export async function readOrganization(userId: string): Promise<OrganizationProfile> {
   const { orgId } = await ensureUserTenancy(userId);
   const rows = await select('SELECT name, logo_url FROM organizations WHERE id = ? LIMIT 1', [orgId]);
   const r = rows[0] || {};
   return { name: r.name ?? null, logoUrl: r.logo_url ?? null };
}

export async function writeOrganization(
   userId: string,
   patch: { name?: string; logoUrl?: string },
): Promise<OrganizationProfile> {
   const { orgId } = await ensureUserTenancy(userId);
   const sets: string[] = [];
   const vals: any[] = [];
   if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name); }
   if (patch.logoUrl !== undefined) { sets.push('logo_url = ?'); vals.push(patch.logoUrl); }
   if (sets.length) {
      sets.push('updated_at = CURRENT_TIMESTAMP');
      await db.query(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`, { replacements: [...vals, orgId] });
   }
   return readOrganization(userId);
}
```
(Note: the test mocks `readOrganization`'s second query via the re-read — `writeOrganization` calls `readOrganization` which calls `ensureUserTenancy` again; that's mocked to be cheap, and the second `select` is the re-read. The UPDATE is call 0, re-read SELECT is call 1.)
- [ ] **Step 4: Run → pass.** **Step 5:** tsc clean; commit `lib/organization.ts __tests__/lib/organization.test.ts` — `feat(org): organization read/write helpers`.

---

### Task 3: `pages/api/organization.ts` (GET/PUT + logo upload)

**Files:** Create `pages/api/organization.ts`; Test `__tests__/api/organization.test.ts`.

- [ ] **Step 1: Failing test** (`__tests__/api/organization.test.ts`):
```ts
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('u1') }));
jest.mock('../../lib/organization', () => ({
  readOrganization: jest.fn().mockResolvedValue({ name: 'Acme', logoUrl: null }),
  writeOrganization: jest.fn(async (_u, p) => ({ name: p.name ?? 'Acme', logoUrl: p.logoUrl ?? null })),
}));
jest.mock('../../lib/uploadToBlob', () => ({
  parseDataUrl: jest.fn(() => ({ buffer: Buffer.from('x'), contentType: 'image/png' })),
  uploadImageBuffer: jest.fn().mockResolvedValue('https://cdn/org-logos/logo.png'),
}));

import handler from '../../pages/api/organization';
import { writeOrganization } from '../../lib/organization';
import { uploadImageBuffer } from '../../lib/uploadToBlob';

const makeRes = () => { const r: any = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };

describe('/api/organization', () => {
  it('GET returns the org profile', async () => {
    const res = makeRes();
    await handler({ method: 'GET', cookies: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ name: 'Acme', logoUrl: null });
  });

  it('PUT uploads a logo data URL to R2 and saves the returned url', async () => {
    const res = makeRes();
    await handler({ method: 'PUT', cookies: {}, body: { name: 'New', logoDataUrl: 'data:image/png;base64,eA==' } } as any, res);
    expect(uploadImageBuffer).toHaveBeenCalled();
    expect((writeOrganization as jest.Mock).mock.calls[0][1]).toEqual({ name: 'New', logoUrl: 'https://cdn/org-logos/logo.png' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('PUT without auth returns 401', async () => {
    const { getCurrentUserId } = require('../../utils/getUser');
    (getCurrentUserId as jest.Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await handler({ method: 'PUT', cookies: {}, body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```
- [ ] **Step 2: Run → fail.** **Step 3: Implement** `pages/api/organization.ts`:
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../utils/getUser';
import { readOrganization, writeOrganization } from '../../lib/organization';
import { parseDataUrl, uploadImageBuffer } from '../../lib/uploadToBlob';

// Logo data URLs can be a few MB — raise the JSON body limit above the 1mb default.
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authenticated' });

   if (req.method === 'GET') {
      return res.status(200).json(await readOrganization(userId));
   }

   if (req.method === 'PUT') {
      const { name, logoDataUrl } = req.body || {};
      const patch: { name?: string; logoUrl?: string } = {};
      if (name !== undefined) patch.name = String(name).slice(0, 80);
      if (typeof logoDataUrl === 'string' && logoDataUrl.startsWith('data:')) {
         const parsed = parseDataUrl(logoDataUrl);
         if (!parsed) return res.status(400).json({ error: 'Invalid image' });
         const url = await uploadImageBuffer(parsed.buffer, parsed.contentType, 'org-logo', 'org-logos');
         if (!url) return res.status(502).json({ error: 'Logo upload failed (R2 not configured?)' });
         patch.logoUrl = url;
      }
      return res.status(200).json(await writeOrganization(userId, patch));
   }

   res.setHeader('Allow', 'GET, PUT');
   return res.status(405).json({ error: 'Method not allowed' });
}
```
- [ ] **Step 4: Run → pass (3/3).** **Step 5:** tsc clean; commit `pages/api/organization.ts __tests__/api/organization.test.ts` — `feat(org): /api/organization GET/PUT with R2 logo upload`.

---

### Task 4: Service + wire `OrganizationGeneralSettings`

**Files:** Create `services/organization.tsx`; Modify `components/settings/OrganizationGeneralSettings.tsx`. (UI wiring — verified by `tsc` + manual smoke; no unit test.)

- [ ] **Step 1: Create `services/organization.tsx`:**
```tsx
import { useMutation, useQuery, useQueryClient } from 'react-query';

export type OrganizationProfile = { name: string | null; logoUrl: string | null };
const KEY = 'organization';

export function useOrganization() {
   return useQuery<OrganizationProfile>(KEY, async () => {
      const res = await fetch('/api/organization');
      const d = await res.json().catch(() => ({}));
      return { name: d.name ?? null, logoUrl: d.logoUrl ?? null };
   }, { staleTime: 60_000 });
}

export function useUpdateOrganization() {
   const qc = useQueryClient();
   return useMutation(async (patch: { name?: string; logoDataUrl?: string }) => {
      const res = await fetch('/api/organization', {
         method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Failed to save organization');
      return res.json();
   }, { onSuccess: () => qc.invalidateQueries(KEY) });
}
```

- [ ] **Step 2: Wire `OrganizationGeneralSettings.tsx`** — replace the stub's local-only behaviour:
  - Seed `orgName` and a `logoUrl` preview from `useOrganization()` once (a `seeded` ref, same pattern as the content-settings components).
  - On file pick (`fileRef` input `onChange`): read the file as a data URL (`FileReader.readAsDataURL`), set a `logoPreview` state + a `pendingLogo` (the data URL) to send on save. Show `logoPreview || logoUrl` as an `<img>` in the 64×64 square (keep the letter-initial fallback when neither exists).
  - `handleSave` → `useUpdateOrganization().mutateAsync({ name: orgName, ...(pendingLogo ? { logoDataUrl: pendingLogo } : {}) })`; on success `toast.success('Saved')`, clear `pendingLogo`; on error `toast.error('Failed to save')`. Disable Save while the mutation is pending.
  - Keep ALL existing inline styles / Surfer layout — this is data wiring, not a redesign. Do NOT alter the visual structure beyond swapping the static letter chip for the `<img>` preview when a logo exists.

- [ ] **Step 3: Verify** — `cd /c/Users/patry/Desktop/serpbear && npx tsc --noEmit` (clean). Manual smoke (`npm run dev`): open Settings → Organization → General; the name loads, editing + Save persists (reload shows it); picking an image uploads to R2 and the logo shows after save. (If R2 env is unset, save returns 502 for the logo — name still saves; that's expected.)

- [ ] **Step 4: Commit** `services/organization.tsx components/settings/OrganizationGeneralSettings.tsx` — `feat(org): wire Organization General settings to /api/organization`.

---

## Self-Review
- Persist org name → Tasks 2,3,4. ✅  Logo → R2 (Task 1 buffer upload + Task 3 decode/upload + Task 4 file pick). ✅
- Org resolved per-caller via `ensureUserTenancy` (Task 2) — inherently tenant-scoped, no cross-org write. ✅
- Body-size limit raised for data URLs (Task 3 `config`). ✅
- Graceful degradation when R2 unset (Task 3 returns 502 for logo; name still saves). ✅
- No placeholders; every step has code. Names consistent: `readOrganization`/`writeOrganization`, `parseDataUrl`/`uploadImageBuffer`, `useOrganization`/`useUpdateOrganization`, `logoUrl`/`logoDataUrl`.
- Out of scope (②): People/Members (④), workspace switcher (③).
