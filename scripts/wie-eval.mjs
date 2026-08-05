#!/usr/bin/env node
/**
 * WIE Evaluation Suite CLI
 *
 *   npm run wie:e2e -- --keyword "szantaż co robić" --domainId 1
 *   npm run wie:e2e -- --articleId 123
 *   npm run wie:e2e -- --trends
 *   npm run wie:e2e -- --help
 *
 * Env: NEXTAUTH_URL / SMOKE_BASE_URL / NEXTJS_URL, CRON_SECRET (or CRON_SECRET_CURRENT)
 * Requires: Next dev server + Python sidecar for full DA/generate.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnvFile(file) {
  try {
    const p = resolve(process.cwd(), file);
    if (!existsSync(p)) return;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch { /* ignore */ }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--trends') out.trends = true;
    else if (a === '--benchmark') out.benchmark = true;
    else if (a === '--skip-judge') out.skipJudge = true;
    else if (a === '--skip-da') out.skipDa = true;
    else if (a === '--skip-generate') out.skipGenerate = true;
    else if (a === '--skip-ao') out.skipAo = true;
    else if (a.startsWith('--') && i + 1 < argv.length) {
      const key = a.slice(2);
      out[key] = argv[++i];
    } else out._.push(a);
  }
  return out;
}

function help() {
  console.log(`WIE Evaluation Suite

Usage:
  npm run wie:e2e -- --keyword "..." --domainId N
  npm run wie:e2e -- --articleId N
  npm run wie:e2e -- --trends [--keyword "..."]
  npm run wie:e2e -- --help

Flags:
  --skip-judge      Skip Editorial Judge LLM
  --skip-da         Resume without Deep Analysis
  --skip-generate   Skip content generate
  --skip-ao         Skip Precision AO
  --benchmark       Force competitor benchmark (default on)

Env:
  SMOKE_BASE_URL / NEXTAUTH_URL / NEXTJS_URL
  CRON_SECRET or CRON_SECRET_CURRENT
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    help();
    process.exit(0);
  }

  const base = (
    process.env.SMOKE_BASE_URL
    || process.env.NEXTAUTH_URL
    || process.env.NEXTJS_URL
    || 'http://127.0.0.1:3000'
  ).replace(/\/$/, '');
  const secret = (process.env.CRON_SECRET_CURRENT || process.env.CRON_SECRET || '').trim();
  if (!secret) {
    console.error('CRON_SECRET (or CRON_SECRET_CURRENT) required');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
    'x-cron-secret': secret,
  };

  if (args.trends) {
    const q = new URLSearchParams({ trends: '1' });
    if (args.keyword) q.set('keyword', args.keyword);
    const r = await fetch(`${base}/api/cron/wie-eval?${q}`, { headers });
    const j = await r.json();
    if (!r.ok) {
      console.error(j);
      process.exit(1);
    }
    console.log(j.trends || JSON.stringify(j, null, 2));
    process.exit(0);
  }

  const body = {
    keyword: args.keyword,
    domainId: args.domainId != null ? parseInt(String(args.domainId), 10) : undefined,
    articleId: args.articleId != null ? parseInt(String(args.articleId), 10) : undefined,
    language: args.language,
    skipJudge: !!args.skipJudge,
    skipDa: !!args.skipDa,
    skipGenerate: !!args.skipGenerate,
    skipAo: !!args.skipAo,
    benchmark: args.benchmark !== false,
  };

  if (!body.articleId && !(body.keyword && Number.isFinite(body.domainId))) {
    help();
    console.error('Error: need --keyword + --domainId, or --articleId');
    process.exit(1);
  }

  console.log('WIE eval →', base, body);
  const r = await fetch(`${base}/api/cron/wie-eval`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    console.error('Non-JSON response', r.status, text.slice(0, 500));
    process.exit(1);
  }
  console.log(JSON.stringify(j, null, 2));
  if (!r.ok || j.pipelineOk === false) process.exit(1);
  if (j.paths?.editorial) console.log('\nEditorial report:', j.paths.editorial);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
