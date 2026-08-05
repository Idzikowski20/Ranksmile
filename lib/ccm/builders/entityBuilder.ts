import type { ContentIr, EntityCandidate } from '../types/ir';
import type { EntityNode } from '../types/graph';

function isEntityCandidate(c: ContentIr['candidates'][number]): c is EntityCandidate {
  return c.kind === 'entity';
}

/** Map IR EntityCandidates → EntityNodes (dedupe by canonicalName). */
export function buildEntityNodes(ir: ContentIr): readonly EntityNode[] {
  const byCanonical = new Map<string, EntityNode>();
  for (const c of ir.candidates) {
    if (!isEntityCandidate(c)) continue;
    const canonical = (c.canonicalHint ?? c.surface).trim();
    if (!canonical) continue;
    const key = canonical.toLocaleLowerCase('pl');
    const prev = byCanonical.get(key);
    if (prev) {
      byCanonical.set(key, {
        ...prev,
        mentionCount: prev.mentionCount + 1,
        aliases: prev.aliases.includes(c.surface)
          ? prev.aliases
          : [...prev.aliases, c.surface],
        confidence: Math.max(prev.confidence, c.confidence),
      });
      continue;
    }
    byCanonical.set(key, {
      id: c.id,
      kind: 'entity',
      canonicalName: canonical,
      aliases: c.surface === canonical ? [] : [c.surface],
      mentionCount: 1,
      importance: 'recommended',
      confidence: c.confidence,
      status: 'covered',
    });
  }
  return [...byCanonical.values()];
}
