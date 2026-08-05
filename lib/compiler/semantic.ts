import type { LexicalAst, SemanticAst, ClaimCandidate } from '../ccm/types/ast';
import { splitAtomicClaims } from '../ccm/builders/factEngine';

const FACTISH_RE = /\d|%|\b(19|20)\d{2}\b|[—–−]|→/;

function claimKind(blockType: string, text: string): ClaimCandidate['kind'] {
  if (blockType === 'heading') return 'definition';
  if (FACTISH_RE.test(text) || text.length >= 24) return 'factish';
  return 'other';
}

/**
 * Semantic stage — sentence-level claims for paragraphs (Fact Engine MVP).
 * Headings stay one claim (definition).
 */
export function buildSemanticAst(ast: LexicalAst): SemanticAst {
  const claims: ClaimCandidate[] = [];
  let n = 0;
  for (const b of ast.blocks) {
    const text = b.text.trim();
    if (!text) continue;
    if (b.type === 'heading') {
      n += 1;
      claims.push({
        id: `c${n}`,
        blockId: b.blockId,
        startOffset: 0,
        endOffset: text.length,
        text,
        kind: 'definition',
      });
      continue;
    }
    const atoms = splitAtomicClaims(text);
    let offset = 0;
    for (const atom of atoms) {
      const start = text.indexOf(atom, offset);
      const startOffset = start >= 0 ? start : offset;
      const endOffset = startOffset + atom.length;
      offset = endOffset;
      n += 1;
      claims.push({
        id: `c${n}`,
        blockId: b.blockId,
        startOffset,
        endOffset,
        text: atom,
        kind: claimKind(b.type, atom),
      });
    }
  }
  return {
    version: 1,
    claims,
    discourse: [],
  };
}
