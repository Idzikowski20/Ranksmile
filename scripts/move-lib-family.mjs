/**
 * Move a family of flat lib/<base>.ts files into lib/<targetDir>/ and rewrite
 * every import specifier project-wide by resolve->recompute. Handles relative
 * and @/ specifiers in from/import/require AND jest.mock()-style string paths.
 *
 * Usage:
 *   node scripts/move-lib-family.mjs <targetDir> <base1> <base2> ...        # dry-run
 *   node scripts/move-lib-family.mjs <targetDir> <base1> <base2> ... --apply
 *
 * Verify after --apply:  npx tsc --noEmit  &&  npx jest <family>
 * See docs/lib-reorg-plan.md.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const rest = args.filter((a) => a !== '--apply');
const targetDir = rest[0];
const BASES = rest.slice(1);
if (!targetDir || BASES.length === 0) {
  console.error('usage: node scripts/move-lib-family.mjs <targetDir> <base...> [--apply]');
  process.exit(1);
}

const oldAbs = (b) => path.resolve(ROOT, 'lib', b + '.ts');
const newAbs = (b) => path.resolve(ROOT, 'lib', targetDir, b + '.ts');
const movedByOld = new Map(BASES.map((b) => [oldAbs(b), newAbs(b)]));
for (const b of BASES) {
  if (!fs.existsSync(oldAbs(b))) { console.error(`missing flat file: lib/${b}.ts`); process.exit(1); }
  if (fs.existsSync(newAbs(b))) { console.error(`collision: lib/${targetDir}/${b}.ts exists`); process.exit(1); }
}

const EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
function resolveSpec(spec, fromDir) {
  let base;
  if (spec.startsWith('@/')) base = path.resolve(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(fromDir, spec);
  else return null;
  for (const e of EXT) if (fs.existsSync(base + e)) return base + e;
  for (const e of EXT) if (fs.existsSync(path.join(base, 'index' + e))) return path.join(base, 'index' + e);
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  return base + '.ts';
}
function toRel(fromDir, absNoExt) {
  let r = path.relative(fromDir, absNoExt).replace(/\\/g, '/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

const SKIP = /(^|[\\/])(node_modules|\.next|\.git|\.venv|\.worktrees|\.claude|graphify-out|python-sidecar|coverage)([\\/]|$)/;
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (SKIP.test(p)) continue;
    if (e.isDirectory()) walk(p, acc);
    else if (EXT.includes(path.extname(e.name))) acc.push(p);
  }
  return acc;
}

// from '...' | import('...') | require('...') | import '...' | jest.mock('...') etc.
const SPEC_RE = /(from\s+|import\s*\(\s*|require\s*\(\s*|import\s+|jest\.(?:mock|doMock|unmock|requireActual|requireMock)\s*\(\s*)(['"])(\.[^'"]*|@\/[^'"]*)\2/g;

const files = walk(ROOT);
let filesChanged = 0, editsTotal = 0;
const sample = [];
for (const F of files) {
  const Fabs = path.resolve(F);
  const Fmoved = movedByOld.has(Fabs);
  const FnewDir = Fmoved ? path.dirname(movedByOld.get(Fabs)) : path.dirname(Fabs);
  let src = fs.readFileSync(F, 'utf8');
  let changed = 0;
  src = src.replace(SPEC_RE, (m, pre, q, spec) => {
    const targetOld = resolveSpec(spec, path.dirname(Fabs));
    if (!targetOld) return m;
    const targetNew = movedByOld.get(targetOld) || targetOld;
    if (!Fmoved && targetNew === targetOld) return m;
    const noExt = targetNew.replace(/\.(ts|tsx|js|jsx|mjs)$/, '');
    const newSpec = toRel(FnewDir, noExt);
    if (newSpec === spec) return m;
    changed++;
    if (sample.length < 20) sample.push(`${path.relative(ROOT, F).replace(/\\/g, '/')}: ${spec} -> ${newSpec}`);
    return `${pre}${q}${newSpec}${q}`;
  });
  if (changed) { filesChanged++; editsTotal += changed; if (APPLY) fs.writeFileSync(F, src); }
}

console.log(`${APPLY ? 'APPLIED' : 'DRY-RUN'} [lib/${targetDir}]: ${editsTotal} edits / ${filesChanged} files`);
for (const s of sample) console.log('  ' + s);
if (APPLY) {
  fs.mkdirSync(path.resolve(ROOT, 'lib', targetDir), { recursive: true });
  for (const b of BASES) fs.renameSync(oldAbs(b), newAbs(b));
  console.log(`moved ${BASES.length} files into lib/${targetDir}/`);
}
