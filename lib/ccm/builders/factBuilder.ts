import type { ContentIr, FactCandidate } from '../types/ir';
import type { FactNode } from '../types/graph';
import { normalizeFactKey, parseSpoHeuristic } from './factEngine';

function isFactCandidate(c: ContentIr['candidates'][number]): c is FactCandidate {
  return c.kind === 'fact';
}

/**
 * Map IR FactCandidates → FactNodes (Fact Engine MVP: SPO + dedupe).
 */
export function buildFactNodes(ir: ContentIr): readonly FactNode[] {
  const out: FactNode[] = [];
  const seen = new Set<string>();

  for (const c of ir.candidates) {
    if (!isFactCandidate(c)) continue;
    const statement = c.statement.trim();
    if (!statement) continue;
    const key = normalizeFactKey(statement);
    if (seen.has(key)) continue;
    seen.add(key);

    const spo = parseSpoHeuristic(statement);
    const subject = spo?.subject ?? c.subject ?? '';
    const predicate = spo?.predicate ?? c.predicate ?? 'states';
    const object = spo?.object ?? c.object ?? '';
    const confidence = Math.min(
      1,
      c.confidence + (spo ? 0.1 : 0) + (/\b(19|20)\d{2}\b/.test(statement) ? 0.05 : 0),
    );

    out.push({
      id: c.id,
      kind: 'fact',
      statement,
      subject,
      predicate,
      object,
      entityIds: c.entityCandidateIds,
      importance: confidence >= 0.6 ? 'recommended' : 'optional',
      confidence,
      status: confidence >= 0.5 ? 'covered' : 'weak',
      verification: 'asserted',
      sectionId: c.blockIds[0],
      ...(spo?.predicate === 'annexed' && /\b(19|20)\d{2}\b/.test(statement)
        ? { time: statement.match(/\b((?:19|20)\d{2})\b/)?.[1] }
        : {}),
    });
  }
  return out;
}
