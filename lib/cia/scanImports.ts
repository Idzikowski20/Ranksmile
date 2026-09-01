import ts from 'typescript';

/** Bump when the static import grammar changes. */
export const SCAN_IMPORTS_VERSION = 3;

/** Extract module specifiers via the TypeScript scanner (AST-accurate — handles
 *  every import/export/require/dynamic-import form; replaced the old regex). */
export function extractImportSpecifiers(source: string): string[] {
  const out = new Set<string>();
  for (const f of ts.preProcessFile(source, true, true).importedFiles) out.add(f.fileName);
  // ts.preProcessFile omits `export * as ns from "x"` (namespace re-export), which would
  // otherwise let a file re-export a forbidden module past the boundary checker unseen.
  // Export declarations are top-level, so a single statement pass covers them.
  const sf = ts.createSourceFile('scan.ts', source, ts.ScriptTarget.Latest, false);
  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      out.add(stmt.moduleSpecifier.text);
    }
  }
  return [...out];
}
