import type { AstBlock, LexicalAst } from '../ccm/types/ast';
import type { LexToken } from './types';

function tokenToBlock(t: LexToken): AstBlock {
  if (t.kind === 'heading') {
    return {
      blockId: t.blockId,
      type: 'heading',
      headingLevel: t.headingLevel ?? 1,
      text: t.text,
    };
  }
  if (t.kind === 'list_item') {
    return { blockId: t.blockId, type: 'list_item', text: t.text };
  }
  if (t.kind === 'other') {
    return { blockId: t.blockId, type: 'other', text: t.text };
  }
  return { blockId: t.blockId, type: 'paragraph', text: t.text };
}

export function parseTokens(tokens: readonly LexToken[]): LexicalAst {
  return {
    version: 1,
    blocks: tokens.map(tokenToBlock),
  };
}
