/**
 * Dead exports budget via ts-prune (+ whitelist).
 * Usage:
 *   node scripts/dead-exports-report.mjs
 *   node scripts/dead-exports-report.mjs --write-baseline
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const baselinePath = path.join(ROOT, 'scripts', 'dead-exports-baseline.json');

/** Paths / patterns that are intentional barrels, editor surface, or generated. */
const WHITELIST = [
  /[\\/]components[\\/]koala[\\/]tokens[\\/]/,
  /[\\/]components[\\/]koala[\\/]vendor[\\/]/,
  /[\\/]components[\\/]koala[\\/]gallery[\\/]/,
  /[\\/]components[\\/]articles[\\/]/,
  /[\\/]components[\\/]editor[\\/]/,
  /[\\/]generated[\\/]/,
  /[\\/]__tests__[\\/]/,
  /[\\/]__mocks__[\\/]/,
  /[\\/]scripts[\\/]archive[\\/]/,
  /[\\/]pages[\\/]api[\\/]/,
  /[\\/]pages[\\/]_app\./,
  /[\\/]pages[\\/]_document\./,
];

function whitelisted(line) {
  return WHITELIST.some((re) => re.test(line));
}

const npx = spawnSync('npx', ['--yes', 'ts-prune'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: true,
  maxBuffer: 20 * 1024 * 1024,
});

if (npx.stderr) process.stderr.write(npx.stderr);
const stdout = npx.stdout || '';
if (npx.status !== 0 && !stdout) {
  console.error('ts-prune failed');
  process.exit(npx.status || 1);
}

const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const unused = lines.filter((l) => !whitelisted(l));
const count = unused.length;

console.log(`Dead exports (post-whitelist): ${count}`);
if (unused.length <= 40) {
  for (const l of unused) console.log(`  ${l}`);
} else {
  for (const l of unused.slice(0, 40)) console.log(`  ${l}`);
  console.log(`  … and ${unused.length - 40} more`);
}

const out = {
  generatedAt: new Date().toISOString(),
  unusedCount: count,
  sample: unused.slice(0, 50),
};

if (process.argv.includes('--write-baseline')) {
  fs.writeFileSync(baselinePath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote ${path.relative(ROOT, baselinePath)}`);
  process.exit(0);
}

if (fs.existsSync(baselinePath)) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const prev = baseline.unusedCount ?? 0;
  if (count > prev) {
    console.error(`\nDead Exports Budget FAIL: ${count} > baseline ${prev}`);
    process.exit(1);
  }
  console.log(`\nBudget OK: ${count} ≤ baseline ${prev}`);
} else {
  console.log('\nNo baseline yet — run with --write-baseline');
}
