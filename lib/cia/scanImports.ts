const IMPORT_RE = /(?:import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s*|import\s*|export\s+[\s\S]*?\s+from\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

/** Bump when the static import grammar changes. */
export const SCAN_IMPORTS_VERSION = 1;

/** Extract module specifiers from TS/JS source (best-effort static scan). */
export function extractImportSpecifiers(source: string): string[] {
  const out = new Set<string>();
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const re = new RegExp(IMPORT_RE.source, 'g');
  let m = re.exec(stripped);
  while (m !== null) {
    out.add(m[1]);
    m = re.exec(stripped);
  }
  return [...out];
}
