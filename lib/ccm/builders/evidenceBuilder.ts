import type { LexicalAst } from '../types/ast';
import type { EvidenceSpanNode, FactNode, KgEdge } from '../types/graph';
import type { CoverageStatus } from '../types/status';

export type EvidenceBuildResult = {
  readonly evidence: readonly EvidenceSpanNode[];
  readonly edges: readonly KgEdge[];
  /** Fact ids that should be downgraded to weak (no supporting span). */
  readonly weakFactIds: readonly string[];
};

const YEAR_RE = /\b((?:19|20)\d{2})\b/g;
const NUMBER_RE = /\b(\d+(?:[.,]\d+)?%?)(?![\p{L}\p{N}_])/gu;

function blockText(ast: LexicalAst, blockId: string | undefined): string {
  if (!blockId) return '';
  return ast.blocks.find((b) => b.blockId === blockId)?.text ?? '';
}

function pushSpan(
  out: EvidenceSpanNode[],
  factId: string,
  blockId: string,
  start: number,
  end: number,
  snippet: string,
  kind: EvidenceSpanNode['evidenceKind'],
  confidence: number,
): void {
  out.push({
    id: `ev_${factId}_${kind}_${start}`,
    kind: 'evidence_span',
    blockId,
    startOffset: start,
    endOffset: end,
    snippet,
    evidenceKind: kind,
    confidence,
    status: 'covered',
  });
}

/**
 * Heuristic evidence for facts (Etap fact-evidence MVP).
 * Dates/numbers in the fact's section block → EvidenceSpan + caller emits supportedBy.
 * No span → fact listed in weakFactIds.
 */
export function buildEvidenceForFacts(
  facts: readonly FactNode[],
  ast: LexicalAst,
): EvidenceBuildResult {
  const evidence: EvidenceSpanNode[] = [];
  const edges: KgEdge[] = [];
  const weakFactIds: string[] = [];

  for (const fact of facts) {
    const blockId = fact.sectionId;
    const block = blockText(ast, blockId);
    const text = fact.statement && block.includes(fact.statement) ? fact.statement : block;
    if (!blockId || !text.trim()) {
      weakFactIds.push(fact.id);
      continue;
    }

    const before = evidence.length;

    YEAR_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = YEAR_RE.exec(text)) !== null) {
      pushSpan(evidence, fact.id, blockId, m.index, m.index + m[0].length, m[0], 'date', 0.85);
    }

    NUMBER_RE.lastIndex = 0;
    while ((m = NUMBER_RE.exec(text)) !== null) {
      // skip years already captured
      if (/^(?:19|20)\d{2}$/.test(m[0])) continue;
      pushSpan(evidence, fact.id, blockId, m.index, m.index + m[0].length, m[0], 'number', 0.75);
    }

    if (evidence.length === before && text.trim().length >= 24) {
      const snippet = text.trim().slice(0, 160);
      pushSpan(evidence, fact.id, blockId, 0, snippet.length, snippet, 'context', 0.55);
    }

    // Subject mention as quote span (Fact Engine MVP)
    if (fact.subject && fact.subject.length >= 3) {
      const idx = text.toLocaleLowerCase('pl').indexOf(fact.subject.toLocaleLowerCase('pl'));
      if (idx >= 0) {
        const already = evidence.slice(before).some(
          (e) => e.startOffset <= idx && e.endOffset >= idx + fact.subject.length,
        );
        if (!already) {
          pushSpan(
            evidence,
            fact.id,
            blockId,
            idx,
            idx + fact.subject.length,
            text.slice(idx, idx + fact.subject.length),
            'quote',
            0.7,
          );
        }
      }
    }

    const added = evidence.slice(before);
    if (added.length === 0) {
      weakFactIds.push(fact.id);
      continue;
    }
    for (const ev of added) {
      edges.push({
        id: `e_supportedBy_${fact.id}_${ev.id}`,
        type: 'supportedBy',
        from: fact.id,
        to: ev.id,
        confidence: ev.confidence,
      });
    }
  }

  return { evidence, edges, weakFactIds };
}

export function applyWeakFactStatus(
  fact: FactNode,
  weakIds: ReadonlySet<string>,
): FactNode {
  if (!weakIds.has(fact.id)) return fact;
  const status: CoverageStatus = 'weak';
  return { ...fact, status, confidence: Math.min(fact.confidence, 0.4) };
}
