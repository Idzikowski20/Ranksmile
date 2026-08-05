/**
 * Ensures every pages/api route (except an explicit skip list) wraps its
 * handler with withOrgPaymentAccess so payment-lock cannot be omitted.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const API_ROOT = path.join(ROOT, 'pages', 'api');

function isSkipped(posixRel: string): boolean {
  const exact = new Set([
    'pages/api/webhooks/stripe.ts',
    'pages/api/health.ts',
    'pages/api/ready.ts',
    'pages/api/login.ts',
    'pages/api/logout.ts',
    'pages/api/koala-example-api.ts',
    'pages/api/favicon.ts',
    'pages/api/confirm-account.ts',
    'pages/api/gsc/callback.ts',
  ]);
  if (exact.has(posixRel)) return true;
  if (posixRel.startsWith('pages/api/auth/')) return true;
  if (posixRel.startsWith('pages/api/invitations/')) return true;
  return false;
}

function walkTs(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTs(full, out);
    else if (ent.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('API payment-access audit', () => {
  it('wraps every non-skipped pages/api handler with withOrgPaymentAccess', () => {
    const files = walkTs(API_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const abs of files) {
      const posixRel = path.relative(ROOT, abs).replace(/\\/g, '/');
      if (isSkipped(posixRel)) continue;
      const content = fs.readFileSync(abs, 'utf8');
      if (!content.includes('withOrgPaymentAccess')) {
        missing.push(posixRel);
      }
    }

    expect(missing).toEqual([]);
  });
});