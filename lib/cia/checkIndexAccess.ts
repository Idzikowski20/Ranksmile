import fs from 'fs';
import path from 'path';
import { CIA_ZONES, type CiaZoneId } from './zones';

/** Consumer zones must not touch knowledge.indexes (use graphQuery). */
const CONSUMER_ZONES: readonly CiaZoneId[] = [
  'projections',
  'planner',
  'intelligence',
];

/** Files under ccm/compiler allowed to reference indexes. */
const INDEX_ALLOW_BASENAMES = new Set([
  'buildIndexes.ts',
  'graphQuery.ts',
  'serialize.ts',
  'ccmSchema.ts',
  'constraintEngine.ts',
  'emptyCcm.ts',
  'assemble.ts',
]);

export type IndexAccessViolation = {
  readonly zoneId: CiaZoneId;
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
};

const INDEX_RE = /\.knowledge\.indexes\b|\.indexes\.(byId|evidenceByFactId|factsByIntentId|entityByCanonical)\b/;

function walkTsFiles(dir: string, acc: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTsFiles(p, acc);
    else if (/\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith('.d.ts')) acc.push(p);
  }
}

function isAllowedFile(rel: string): boolean {
  const base = path.basename(rel);
  if (INDEX_ALLOW_BASENAMES.has(base)) return true;
  // types-only / builders don't need indexes
  if (rel.includes('/types/')) return true;
  return false;
}

/** Scan consumer zones for direct GraphIndexes access. */
export function findIndexAccessViolations(repoRoot: string): IndexAccessViolation[] {
  const out: IndexAccessViolation[] = [];
  for (const zone of CIA_ZONES) {
    if (!CONSUMER_ZONES.includes(zone.id)) continue;
    const abs = path.join(repoRoot, ...zone.root.split('/').filter(Boolean));
    const files: string[] = [];
    walkTsFiles(abs, files);
    for (const file of files) {
      const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
      if (isAllowedFile(rel)) continue;
      const source = fs.readFileSync(file, 'utf8');
      const lines = source.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!INDEX_RE.test(line)) return;
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
        out.push({
          zoneId: zone.id,
          file: rel,
          line: i + 1,
          snippet: line.trim().slice(0, 120),
        });
      });
    }
  }
  return out;
}
