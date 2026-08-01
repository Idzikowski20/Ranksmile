/**
 * Token audit:
 * 1) Strict rules for charts/gallery/theme/widgets
 * 2) Theme-io across koala
 * 3) App-shell: ban var(--gray-*)
 * 4) Token Debt Budget vs scripts/token-debt-baseline.json (cannot increase)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();
const ROOT = path.join(CWD, 'components', 'koala');

const STRICT_GLOBS = [
  `${path.sep}charts${path.sep}`,
  `${path.sep}gallery${path.sep}`,
  `${path.sep}theme${path.sep}`,
];

const STRICT_FILES = [
  path.join('components', 'koala', 'product', 'widgets.tsx'),
];

const WHITELIST_DIR_PARTS = [
  `${path.sep}tokens${path.sep}`,
  `${path.sep}vendor${path.sep}`,
  `${path.sep}generated${path.sep}`,
  `${path.sep}core${path.sep}`,
  `${path.sep}icons${path.sep}`,
];

/** Ban palette vars here (helpers excluded — intentional chromatic SEO chips). */
const APP_SHELL_ROOTS = [
  path.join('components', 'koala', 'shell'),
  path.join('components', 'koala', 'primitives'),
  path.join('components', 'settings'),
  path.join('components', 'aiVisibility'),
  path.join('components', 'searchIntelligence'),
  path.join('components', 'rankTracking'),
  path.join('pages', 'sites'),
];

const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);

const RULES = [
  { name: 'hex-color', re: /#[0-9a-fA-F]{3,8}\b/g },
  { name: 'rgb', re: /\brgba?\s*\(/g },
  { name: 'hsl', re: /\bhsla?\s*\(/g },
  { name: 'raw-spacing-px', re: /(?:padding|margin|gap|min-height|min-width|max-height|max-width)\s*[:=]\s*['"`]?[1-9]\d*px/gi },
  { name: 'raw-border-radius', re: /border(?:Radius|-radius)\s*[:=]\s*['"`]?[1-9]\d*px/g },
  { name: 'raw-box-shadow', re: /box(?:Shadow|-shadow)\s*[:=]\s*['"`][^'"`]*[0-9]+px/g },
  { name: 'raw-z-index', re: /z(?:Index|-index)\s*[:=]\s*['"`]?\d{2,}/g },
];

const GRAY_VAR_RE = /var\(\s*--gray-[^)]+\)/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

function isWhitelisted(file) {
  return WHITELIST_DIR_PARTS.some((w) => file.includes(w));
}

function inStrictScope(file) {
  const rel = path.relative(CWD, file).replace(/\\/g, '/');
  if (STRICT_FILES.some((f) => rel === f.replace(/\\/g, '/'))) return true;
  return STRICT_GLOBS.some((g) => file.includes(g));
}

function checkThemeIo(file, line, lineNo, violations) {
  if (file.includes(`${path.sep}theme${path.sep}`)) return;
  if (line.includes('check-koala-tokens-ignore')) return;
  if (/localStorage|prefers-color-scheme|document\.cookie/.test(line)) {
    violations.push({
      file: path.relative(CWD, file),
      line: lineNo,
      rule: 'theme-io',
      text: line.trim().slice(0, 120),
    });
  }
}

const violations = [];
const files = walk(ROOT).filter((f) => !isWhitelisted(f) && inStrictScope(f));
const allKoala = walk(ROOT).filter((f) => !isWhitelisted(f));

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes('check-koala-tokens-ignore') || line.trim().startsWith('//')) return;
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      if (rule.re.test(line)) {
        violations.push({
          file: path.relative(CWD, file),
          line: i + 1,
          rule: rule.name,
          text: line.trim().slice(0, 120),
        });
      }
    }
  });
}

for (const file of allKoala) {
  const src = fs.readFileSync(file, 'utf8');
  src.split(/\r?\n/).forEach((line, i) => {
    checkThemeIo(file, line, i + 1, violations);
  });
}

for (const relRoot of APP_SHELL_ROOTS) {
  const dir = path.join(CWD, relRoot);
  for (const file of walk(dir)) {
    if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
    const rel = path.relative(CWD, file);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (line.includes('check-koala-tokens-ignore') || line.trim().startsWith('//')) return;
      GRAY_VAR_RE.lastIndex = 0;
      if (GRAY_VAR_RE.test(line)) {
        violations.push({
          file: rel,
          line: i + 1,
          rule: 'palette-var',
          text: line.trim().slice(0, 120),
        });
      }
    });
  }
}

if (violations.length) {
  console.error(`check-koala-tokens: ${violations.length} violation(s)\n`);
  for (const v of violations.slice(0, 80)) {
    console.error(`${v.file}:${v.line} [${v.rule}] ${v.text}`);
  }
  if (violations.length > 80) console.error(`… and ${violations.length - 80} more`);
  process.exit(1);
}

const debt = spawnSync(process.execPath, [path.join(CWD, 'scripts', 'token-debt-report.mjs')], {
  cwd: CWD,
  encoding: 'utf8',
});
process.stdout.write(debt.stdout || '');
process.stderr.write(debt.stderr || '');
if (debt.status !== 0) process.exit(debt.status || 1);

console.log(`check-koala-tokens: OK (strict ${files.length} files; theme-io ${allKoala.length} files)`);
