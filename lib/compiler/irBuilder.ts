import type { LexicalAst, SemanticAst } from '../ccm/types/ast';
import type {
  ContentIr,
  EntityCandidate,
  FactCandidate,
  IntentCandidate,
  IrClaim,
  IrParagraph,
  SemanticCandidate,
} from '../ccm/types/ir';
import { parseSpoHeuristic } from '../ccm/builders/factEngine';

/** Multi-word Proper Nouns + single Capitalized tokens (len≥4). */
const MULTI_ENTITY =
  /\b[\p{Lu}][\p{L}\p{M}]+(?:\s+[\p{Lu}][\p{L}\p{M}]+)+\b/gu;
const SINGLE_ENTITY = /\b[\p{Lu}][\p{L}\p{M}]{3,}\b/gu;

function extractSurfaces(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const re of [MULTI_ENTITY, SINGLE_ENTITY]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const s = m[0].trim();
      const key = s.toLocaleLowerCase('pl');
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(s);
    }
  }
  return found;
}

/**
 * IR from AST + Semantic AST — heuristic candidates for builders.
 * Builders consume these candidates (RFC 15), not HTML.
 */
export function buildContentIr(
  ast: LexicalAst,
  semantic: SemanticAst,
  contentHash: string,
): ContentIr {
  const claimsByBlock = new Map<string, string[]>();
  for (const c of semantic.claims) {
    const list = claimsByBlock.get(c.blockId) ?? [];
    list.push(c.id);
    claimsByBlock.set(c.blockId, list);
  }

  const paragraphs: IrParagraph[] = ast.blocks.map((b, i) => ({
    id: `p${i + 1}`,
    blockId: b.blockId,
    claimIds: claimsByBlock.get(b.blockId) ?? [],
  }));

  const paraByBlock = new Map(paragraphs.map((p) => [p.blockId, p.id]));

  const claims: IrClaim[] = semantic.claims.map((c) => ({
    id: c.id,
    paragraphId: paraByBlock.get(c.blockId) ?? 'p0',
    blockId: c.blockId,
    startOffset: c.startOffset,
    endOffset: c.endOffset,
    text: c.text,
    kind: c.kind,
  }));

  const entityByKey = new Map<string, EntityCandidate>();
  const candidates: SemanticCandidate[] = [];
  let intentPriority = 0;

  for (const b of ast.blocks) {
    if (b.type !== 'heading') continue;
    const label = b.text.trim();
    if (!label) continue;
    const intent: IntentCandidate = {
      id: `ic_${b.blockId}`,
      kind: 'intent',
      confidence: 0.8,
      blockIds: [b.blockId],
      label,
      userGoal: label,
      priority: intentPriority,
    };
    intentPriority += 1;
    candidates.push(intent);
  }

  for (const claim of claims) {
    if (claim.kind === 'definition') continue;

    const surfaces = extractSurfaces(claim.text);
    const entityIds: string[] = [];
    for (const surface of surfaces) {
      const key = surface.toLocaleLowerCase('pl');
      const existing = entityByKey.get(key);
      if (existing) {
        if (!existing.blockIds.includes(claim.blockId)) {
          const updated: EntityCandidate = {
            ...existing,
            blockIds: [...existing.blockIds, claim.blockId],
          };
          entityByKey.set(key, updated);
        }
        entityIds.push(existing.id);
        continue;
      }
      const ent: EntityCandidate = {
        id: `ec_${entityByKey.size + 1}`,
        kind: 'entity',
        confidence: 0.6,
        blockIds: [claim.blockId],
        claimId: claim.id,
        surface,
        canonicalHint: surface,
      };
      entityByKey.set(key, ent);
      entityIds.push(ent.id);
    }

    const spo = parseSpoHeuristic(claim.text);
    const fact: FactCandidate = {
      id: `fc_${claim.id}`,
      kind: 'fact',
      confidence: claim.kind === 'factish' ? 0.7 : 0.45,
      blockIds: [claim.blockId],
      claimId: claim.id,
      statement: claim.text,
      subject: spo?.subject ?? surfaces[0],
      predicate: spo?.predicate ?? 'states',
      object: spo?.object,
      entityCandidateIds: entityIds,
    };
    candidates.push(fact);
  }

  candidates.push(...entityByKey.values());

  return {
    version: 1,
    contentHash,
    paragraphs,
    claims,
    candidates,
  };
}
