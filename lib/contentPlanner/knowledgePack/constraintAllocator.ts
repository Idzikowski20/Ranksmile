import type { KnowledgePack, WriterConstraint } from './types';

export function allocateNoBrandMentionConstraints(
  packs: KnowledgePack[],
  allowBrandNiche: boolean,
): KnowledgePack[] {
  if (allowBrandNiche || packs.length === 0) {
    return packs;
  }

  const lastIndex = packs.length - 1;
  return packs.map((pack, index) => {
    if (index === lastIndex) {
      return pack;
    }

    const constraint: WriterConstraint = {
      type: 'NoBrandMention',
      reason: 'Brand niche not allowed in non-final sections',
      severity: 'warning',
      scope: 'section',
    };

    return {
      ...pack,
      sectionConstraints: [...pack.sectionConstraints, constraint],
    };
  });
}
