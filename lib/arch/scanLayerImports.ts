import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { LAYER_RULES } from './layerRules';

export type LayerViolation = { file: string; specifier: string; layer: string };

/**
 * Extract module specifiers via the TypeScript compiler API (not regex).
 * `ts.preProcessFile` uses the TS scanner and correctly handles every
 * import/export/require/dynamic-import() form, type-only imports, and
 * multi-line statements.
 */
export function extractSpecifiers(source: string): string[] {
  return ts
    .preProcessFile(source, /* readImportFiles */ true, /* detectJavaScriptImports */ true)
    .importedFiles.map((f) => f.fileName);
}

const EXT = new Set(['.ts', '.tsx']);
function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (EXT.has(path.extname(e.name))) acc.push(p);
  }
  return acc;
}

/** Scan every configured layer root and return specifiers that violate its rule. */
export function findLayerViolations(rootDir: string): LayerViolation[] {
  const out: LayerViolation[] = [];
  for (const rule of LAYER_RULES) {
    const base = path.join(rootDir, rule.root);
    for (const file of walk(base)) {
      const rel = path.relative(rootDir, file).replace(/\\/g, '/');
      if (rule.exclude?.test(rel)) continue;
      const specs = extractSpecifiers(fs.readFileSync(file, 'utf8'));
      for (const spec of specs) {
        if (rule.forbid.some((re) => re.test(spec))) {
          out.push({ file: path.relative(rootDir, file).replace(/\\/g, '/'), specifier: spec, layer: rule.label });
        }
      }
    }
  }
  return out;
}
