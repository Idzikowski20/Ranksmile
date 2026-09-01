import type { KnowledgePack, ParagraphPlan, TermUsage } from '@/src/infrastructure/contentPlanner/knowledgePack/types';

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 3);
}

/**
 * How well `term` belongs in a section, as the share of its words the section's heading
 * and objective already use. Round-robin alone dropped "objawy przemocy psychicznej"
 * into the section about legal remedies as readily as the one about symptoms, and the
 * writer either ignored it or stuffed it — both cost term coverage.
 */
function affinity(termWords: string[], sectionWords: Set<string>): number {
  if (termWords.length === 0) return 0;
  const hits = termWords.filter((w) => sectionWords.has(w)).length;
  return hits / termWords.length;
}

export function allocateTerms(
  paragraphs: ParagraphPlan[],
  terms: string[],
  packs: KnowledgePack[] = [],
): ParagraphPlan[] {
  if (terms.length === 0 || paragraphs.length === 0) {
    return paragraphs;
  }

  const result = paragraphs.map((paragraph) => ({
    ...paragraph,
    keywords: [...paragraph.keywords],
  }));

  const sectionWords = new Map<string, Set<string>>();
  for (const pack of packs) {
    sectionWords.set(pack.sectionId, new Set(words(`${pack.heading} ${pack.objective}`)));
  }

  const bySection = new Map<string, typeof result>();
  for (const paragraph of result) {
    const list = bySection.get(paragraph.sectionId);
    if (list) list.push(paragraph);
    else bySection.set(paragraph.sectionId, [paragraph]);
  }

  for (let i = 0; i < terms.length; i += 1) {
    const term = terms[i];
    if (!term) continue;

    const termWords = words(term);
    let best: { sectionId: string; score: number } | null = null;
    for (const [sectionId, wordSet] of sectionWords) {
      const score = affinity(termWords, wordSet);
      if (score > 0 && (!best || score > best.score)) best = { sectionId, score };
    }

    // No section claims the term — spread it round-robin as before, so a term with no
    // obvious home is still asked for somewhere rather than dropped.
    const candidates = (best && bySection.get(best.sectionId)) || result;
    const targetParagraph = best
      ? candidates.reduce((a, b) => (a.keywords.length <= b.keywords.length ? a : b))
      : candidates[i % candidates.length];
    if (!targetParagraph) continue;

    const usage: TermUsage = {
      term,
      importance: 'critical',
      minOccurrences: 1,
      maxOccurrences: 5,
      preferredParagraphs: [targetParagraph.id],
      required: true,
      actualOccurrences: null,
    };

    targetParagraph.keywords.push(usage);
  }

  return result;
}
