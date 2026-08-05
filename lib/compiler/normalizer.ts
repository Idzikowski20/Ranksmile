import type { LexicalAst } from '../ccm/types/ast';

/** Skeleton normalizer — trim block text, keep blockIds. */
export function normalizeAst(ast: LexicalAst): LexicalAst {
  return {
    version: 1,
    blocks: ast.blocks.map((b) => ({
      ...b,
      text: b.text.trim(),
    })),
  };
}
