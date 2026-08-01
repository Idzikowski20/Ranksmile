#!/usr/bin/env node
/**
 * Minimal post-deploy smoke: health → ready → system/check (cron secret).
 * Env: SMOKE_BASE_URL (required), CRON_SECRET (required for system/check).
 */
const base = (process.env.SMOKE_BASE_URL || '').replace(/\/$/, '');
const secret = (process.env.CRON_SECRET_CURRENT || process.env.CRON_SECRET || '').trim();

if (!base) {
  console.error('SMOKE_BASE_URL required');
  process.exit(1);
}

async function get(path, headers = {}) {
  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { res, json, text };
}

(async () => {
  const health = await get('/api/health');
  if (!health.res.ok || !health.json?.ok) {
    console.error('health failed', health.res.status, health.text);
    process.exit(1);
  }
  console.log('health ok');

  const ready = await get('/api/ready');
  if (!ready.res.ok || !ready.json?.ok) {
    console.error('ready failed', ready.res.status, ready.text);
    process.exit(1);
  }
  console.log('ready ok');

  if (!secret) {
    console.error('CRON_SECRET required for /api/system/check');
    process.exit(1);
  }
  const check = await get('/api/system/check', { Authorization: `Bearer ${secret}` });
  if (!check.res.ok || !check.json?.ready) {
    console.error('system/check not ready', check.res.status, check.text);
    process.exit(1);
  }
  console.log('system/check ready', `score=${check.json.score}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
