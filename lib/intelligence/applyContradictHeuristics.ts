/**
 * Heuristic contradicts edges (CIAS-006 myth vs exception). O(n²) capped.
 */
import type { CanonicalContentModel } from '../ccm/types/ccm';
import { buildGraphIndexes } from '../ccm/buildIndexes';
import { isFactNode, type FactNode, type KgEdge, type KgNode } from '../ccm/types/graph';

const ABSOLUTE = /\b(zawsze|nigdy|absolutnie|koniecznie muszą|zawsze muszą)\b/iu;
const EXCEPTION = /\b(nie zawsze|wyjątk|mit[,.]|nie oznacza|nie przysługuje|nie muszą)\b/iu;

function tokenize(s: string): string[] {
  return s
    .toLocaleLowerCase('pl')
    .match(/[a-ząćęłńóśźż0-9]+/giu) ?? [];
}

function shareTokens(a: string, b: string): number {
  const ta = new Set(tokenize(a).filter((w) => w.length >= 4));
  const tb = tokenize(b).filter((w) => w.length >= 4);
  let n = 0;
  for (const w of tb) if (ta.has(w)) n += 1;
  return n;
}

function isMythExceptionPair(a: FactNode, b: FactNode): boolean {
  const aAbs = ABSOLUTE.test(a.statement);
  const aExc = EXCEPTION.test(a.statement);
  const bAbs = ABSOLUTE.test(b.statement);
  const bExc = EXCEPTION.test(b.statement);
  if (!((aAbs && bExc) || (bAbs && aExc))) return false;
  return shareTokens(a.statement, b.statement) >= 2;
}

/**
 * Add `contradicts` edges for absolute-claim vs exception-claim pairs.
 * ponytail: O(n²) scan capped at 48 facts — upgrade: embedding conflict detect.
 */
export function applyContradictHeuristics(
  model: CanonicalContentModel,
): CanonicalContentModel {
  const facts = model.knowledge.graph.nodes.filter(isFactNode).slice(0, 48);
  if (facts.length < 2) return model;

  const nodes: KgNode[] = [...model.knowledge.graph.nodes];
  const edges: KgEdge[] = [...model.knowledge.graph.edges];
  const existing = new Set(
    edges.filter((e) => e.type === 'contradicts').map((e) => `${e.from}->${e.to}`),
  );
  let added = 0;

  for (let i = 0; i < facts.length; i += 1) {
    for (let j = i + 1; j < facts.length; j += 1) {
      const a = facts[i];
      const b = facts[j];
      if (!isMythExceptionPair(a, b)) continue;
      const key = `${a.id}->${b.id}`;
      const rev = `${b.id}->${a.id}`;
      if (existing.has(key) || existing.has(rev)) continue;
      edges.push({
        id: `e_contradicts_${a.id}_${b.id}`,
        type: 'contradicts',
        from: a.id,
        to: b.id,
        confidence: 0.65,
      });
      existing.add(key);
      added += 1;
    }
  }

  if (!added) return model;
  return {
    ...model,
    knowledge: {
      graph: { nodes, edges },
      indexes: buildGraphIndexes(nodes, edges),
    },
    compiler: {
      ...model.compiler,
      notes: [...model.compiler.notes, `contradicts:+${added}`],
    },
  };
}
