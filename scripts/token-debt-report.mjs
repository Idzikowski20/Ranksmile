/**
 * Token Debt Dashboard — count hex in UI buckets.
 * Usage: node scripts/token-debt-report.mjs [--write-baseline] [--wave <name>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { appendDebtHistory, countHex, walk } from './lib/tokenDebt.mjs';

const ROOT = process.cwd();

const BUCKETS = {
  pages: ['pages'],
  components: ['components'],
  css: ['styles'],
  'articles-chrome': ['components/articles', 'pages/articles'],
};

const report = {};
for (const [name, dirs] of Object.entries(BUCKETS)) {
  const files = dirs.flatMap((d) => walk(path.join(ROOT, d)));
  report[name] = countHex(files);
}

const totalHex = (report.pages?.hex || 0) + (report.components?.hex || 0);
const out = {
  generatedAt: new Date().toISOString(),
  buckets: report,
  totalPagesComponentsHex: totalHex,
};

console.log('Remaining token debt');
for (const [k, v] of Object.entries(report)) {
  console.log(`  ${k}: ${v.hex} hex in ${v.files} files`);
}
console.log(`  total (pages+components): ${totalHex}`);

const baselinePath = path.join(ROOT, 'scripts', 'token-debt-baseline.json');
const writeBaseline = process.argv.includes('--write-baseline');
const waveIdx = process.argv.indexOf('--wave');
const wave = waveIdx >= 0 ? (process.argv[waveIdx + 1] || 'manual') : (writeBaseline ? 'baseline-write' : null);

if (writeBaseline) {
  fs.writeFileSync(baselinePath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote ${path.relative(ROOT, baselinePath)}`);
  appendDebtHistory({
    date: out.generatedAt,
    wave: wave || 'baseline-write',
    totalPagesComponentsHex: totalHex,
    buckets: report,
  });
  console.log('Appended cleanup/token-debt-history.jsonl');
} else if (fs.existsSync(baselinePath)) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const prev = baseline.totalPagesComponentsHex ?? 0;
  if (totalHex > prev) {
    console.error(`\nToken Debt Budget FAIL: ${totalHex} > baseline ${prev}`);
    process.exit(1);
  }
  console.log(`\nBudget OK: ${totalHex} ≤ baseline ${prev}`);
}

export { out };
