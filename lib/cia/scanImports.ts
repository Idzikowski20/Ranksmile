import ts from 'typescript';

/** Bump when the static import grammar changes. */
export const SCAN_IMPORTS_VERSION = 2;

/** Extract module specifiers via the TypeScript scanner (AST-accurate — handles
 *  every import/export/require/dynamic-import form; replaced the old regex). */
export function extractImportSpecifiers(source: string): string[] {
  const out = new Set<string>();
  for (const f of ts.preProcessFile(source, true, true).importedFiles) out.add(f.fileName);
  return [...out];
}
