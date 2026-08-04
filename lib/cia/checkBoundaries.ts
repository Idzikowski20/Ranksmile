import fs from 'fs';
import path from 'path';
import { extractImportSpecifiers } from './scanImports';
import { CIA_ZONES, isForbiddenImport, type CiaZoneId } from './zones';

export type BoundaryViolation = {
  readonly zoneId: CiaZoneId;
  readonly file: string;
  readonly specifier: string;
};

export function checkSourceAgainstZone(
  zoneId: CiaZoneId,
  source: string,
): readonly { specifier: string }[] {
  return extractImportSpecifiers(source)
    .filter((spec) => isForbiddenImport(zoneId, spec))
    .map((specifier) => ({ specifier }));
}

function walkTsFiles(dir: string, acc: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkTsFiles(p, acc);
    } else if (/\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith('.d.ts')) {
      acc.push(p);
    }
  }
}

export function findCiaBoundaryViolations(repoRoot: string): BoundaryViolation[] {
  const out: BoundaryViolation[] = [];
  for (const zone of CIA_ZONES) {
    const abs = path.join(repoRoot, ...zone.root.split('/').filter(Boolean));
    const files: string[] = [];
    walkTsFiles(abs, files);
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const { specifier } of checkSourceAgainstZone(zone.id, source)) {
        out.push({
          zoneId: zone.id,
          file: path.relative(repoRoot, file).replace(/\\/g, '/'),
          specifier,
        });
      }
    }
  }
  return out;
}
