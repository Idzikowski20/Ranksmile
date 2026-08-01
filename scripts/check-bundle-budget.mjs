/**
 * Checks first-party JS chunk sizes against budgets after `next build`.
 * Limits are uncompressed bytes (conservative vs gzip targets in plan).
 */
import fs from 'node:fs';
import path from 'node:path';

const BUDGETS = {
  // Post motion-lazy + date-fns locale fix (2026-07-09, uncompressed chunk bytes)
  'pages/_app': 600_000,
  'pages/sites/[domain]/performance': 650_000,
  'pages/articles/[id]': 1_100_000,
  // Dashboard composition budget (plan v3.1 ~250kB gzip ≈ ~750kB raw conservative)
  'pages/dashboard': 750_000,
};

const baselinePath = path.join('scripts', 'bundle-baseline.json');

function findChunk(dir, prefix) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir, { recursive: true });
  for (const f of files) {
    const name = String(f);
    if (!name.endsWith('.js')) continue;
    if (name.includes(prefix.replace(/\//g, '-'))) return path.join(dir, name);
  }
  return null;
}

function measurePageChunk(pageKey) {
  const slug = pageKey.replace(/\[domain\]/g, '[domain]').replace(/\[id\]/g, '[id]');
  const dir = path.join('.next', 'static', 'chunks', 'pages');
  if (!fs.existsSync(dir)) return null;
  const candidates = fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.js'));
  const needle = pageKey.replace('pages/', '').replace(/\//g, '/');
  const match = candidates.find((f) => f.replace(/\\/g, '/').includes(needle));
  if (!match) return null;
  const full = path.join(dir, match);
  return { path: full, bytes: fs.statSync(full).size };
}

const results = {};
let failed = false;

for (const [key, limit] of Object.entries(BUDGETS)) {
  const m = measurePageChunk(key);
  if (!m) {
    results[key] = { status: 'skip', reason: 'chunk not found (run next build first)' };
    continue;
  }
  const ok = m.bytes <= limit;
  if (!ok) failed = true;
  results[key] = { bytes: m.bytes, limit, ok };
  const kb = Math.round(m.bytes / 1024);
  const limitKb = Math.round(limit / 1024);
  console.log(`${ok ? 'OK' : 'FAIL'} ${key}: ${kb} KB (budget ${limitKb} KB)`);
}

fs.writeFileSync(baselinePath, JSON.stringify({ measuredAt: new Date().toISOString(), results }, null, 2));

if (failed) {
  console.error('Bundle budget exceeded.');
  process.exit(1);
}

console.log('Bundle budgets OK.');
