import type { ParagraphPlan, TermUsage } from './types';

export function allocateTerms(
  paragraphs: ParagraphPlan[],
  terms: string[],
): ParagraphPlan[] {
  if (terms.length === 0 || paragraphs.length === 0) {
    return paragraphs;
  }

  return paragraphs.map((paragraph, index) => {
    const termIndex = index % terms.length;
    const term = terms[termIndex];
    if (!term) {
      return paragraph;
    }

    const usage: TermUsage = {
      term,
      importance: 'critical',
      minOccurrences: 1,
      maxOccurrences: 5,
      preferredParagraphs: [paragraph.id],
      required: true,
      actualOccurrences: null,
    };

    return {
      ...paragraph,
      keywords: [...paragraph.keywords, usage],
    };
  });
}
