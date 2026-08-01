/**
 * Shared hex-debt walk helpers for token-debt-report + future CI tooling.
 */
import fs from 'node:fs';
import path from 'node:path';

export const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
export const HEX = /#[0-9a-fA-F]{3,8}\b/g;

export const EXCLUDE_PARTS = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}.next${path.sep}`,
  `${path.sep}koala${path.sep}tokens${path.sep}`,
  `${path.sep}koala${path.sep}vendor${path.sep}`,
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}__mocks__${path.sep}`,
  `${path.sep}scripts${path.sep}archive${path.sep}`,
];

export function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

export function excluded(file) {
  return EXCLUDE_PARTS.some((p) => file.includes(p));
}

export function countHex(files) {
  let matches = 0;
  let fileCount = 0;
  for (const file of files) {
    if (excluded(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const n = (src.match(HEX) || []).length;
    if (n > 0) {
      fileCount += 1;
      matches += n;
    }
  }
  return { files: fileCount, hex: matches };
}

export function appendDebtHistory(entry) {
  const historyPath = path.join(process.cwd(), 'cleanup', 'token-debt-history.jsonl');
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.appendFileSync(historyPath, `${JSON.stringify(entry)}\n`);
}
