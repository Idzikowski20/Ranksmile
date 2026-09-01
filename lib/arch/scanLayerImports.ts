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
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (EXT.has(path.extname(e.name))) acc.push(p);
  }
  return acc;
}

/** Repo-relative resolution of an internal specifier; null for bare (npm/node:) imports. */
function resolveInternal(spec: string, fileAbs: string, rootDir: string): string | null {
  let abs: string;
  if (spec.startsWith('@/')) abs = path.resolve(rootDir, spec.slice(2));
  else if (spec.startsWith('.')) abs = path.resolve(path.dirname(fileAbs), spec);
  else return null;
  return path.relative(rootDir, abs).replace(/\\/g, '/');
}

/**
 * Scan every configured layer root and return specifiers that violate its rule.
 * Throws if a configured root is missing so a rename can't silently disable the
 * boundary check (fail closed).
 */
export function findLayerViolations(rootDir: string): LayerViolation[] {
  const out: LayerViolation[] = [];
  const seen = new Set<string>();
  for (const rule of LAYER_RULES) {
    const base = path.join(rootDir, rule.root);
    if (!fs.existsSync(base)) {
      throw new Error(`Layer root not found: ${rule.root} — rename it in lib/arch/layerRules.ts or the boundary check silently passes.`);
    }
    for (const file of walk(base)) {
      const rel = path.relative(rootDir, file).replace(/\\/g, '/');
      for (const spec of extractSpecifiers(fs.readFileSync(file, 'utf8'))) {
        const resolved = resolveInternal(spec, file, rootDir);
        const bad = resolved === null
          ? rule.forbidBare.some((re) => re.test(spec))
          : !rule.allowInternal.some((re) => re.test(resolved));
        if (!bad) continue;
        const key = `${rel}\0${spec}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ file: rel, specifier: spec, layer: rule.label });
      }
    }
  }
  return out;
}
