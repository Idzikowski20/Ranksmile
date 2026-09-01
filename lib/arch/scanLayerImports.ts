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
  const out = new Set<string>();
  for (const f of ts.preProcessFile(source, /* readImportFiles */ true, /* detectJavaScriptImports */ true).importedFiles) {
    out.add(f.fileName);
  }
  // ts.preProcessFile omits `export * as ns from "x"` (namespace re-export), which would let
  // a core file re-export a forbidden layer past this rule unseen. Export declarations are
  // top-level, so a single statement pass catches them.
  const sf = ts.createSourceFile('scan.ts', source, ts.ScriptTarget.Latest, false);
  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      out.add(stmt.moduleSpecifier.text);
    }
  }
  return [...out];
}

const EXT = new Set(['.ts', '.tsx']);
/** Tests and mocks legitimately import infrastructure fixtures — the layer rule is about
 *  production code, so they are excluded from the scan. */
function isTestFile(name: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(name) || name.endsWith('.d.ts');
}
function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === '__mocks__') continue;
      walk(p, acc);
    } else if (EXT.has(path.extname(e.name)) && !isTestFile(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

/** Scan every configured layer root and return specifiers that violate its rule. */
export function findLayerViolations(rootDir: string): LayerViolation[] {
  const out: LayerViolation[] = [];
  for (const rule of LAYER_RULES) {
    const base = path.join(rootDir, rule.root);
    for (const file of walk(base)) {
      const specs = extractSpecifiers(fs.readFileSync(file, 'utf8'));
      for (const spec of specs) {
        // Relative imports stay inside the layer and are always allowed. Everything else
        // must match the allow-list; a bare package or other-layer import that slips past
        // every `forbid` pattern is still a violation.
        const isRelative = spec.startsWith('.');
        const denied = rule.forbid.some((re) => re.test(spec));
        const notAllowed = !isRelative && !rule.allowOnly.some((re) => re.test(spec));
        if (denied || notAllowed) {
          out.push({ file: path.relative(rootDir, file).replace(/\\/g, '/'), specifier: spec, layer: rule.label });
        }
      }
    }
  }
  return out;
}
