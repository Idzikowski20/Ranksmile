import type { ParagraphPlan, TermUsage } from './types';

export function allocateTerms(
  paragraphs: ParagraphPlan[],
  terms: string[],
): ParagraphPlan[] {
  if (terms.length === 0 || paragraphs.length === 0) {
    return paragraphs;
  }

  const result = paragraphs.map((paragraph) => ({
    ...paragraph,
    keywords: [...paragraph.keywords],
  }));

  for (let i = 0; i < terms.length; i += 1) {
    const term = terms[i];
    const targetParagraph = result[i % result.length];
    if (!term || !targetParagraph) {
      continue;
    }

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
