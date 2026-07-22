/**
 * GEO (Generative Engine Optimization) cues — extractability / citation readiness.
 */
export type GeoCues = {
  hasEarlyAnswer: boolean;
  hasFaq: boolean;
  hasCitations: boolean;
  hasAuthor: boolean;
  hasSchema: boolean;
  score: number;
  promptHints: string[];
};

export function computeGeoCues(html: string, plainText: string): GeoCues {
  const early = plainText.slice(0, 600);
  const hasEarlyAnswer = early.length > 80 && /[.?!]/.test(early);
  const hasFaq = /faq|częste pytania|<details/i.test(html);
  const hasCitations = (html.match(/<a\s[^>]*href=["']https?:/gi) || []).length >= 2;
  const hasAuthor = /author|autor|napisane przez/i.test(html + plainText);
  const hasSchema = /application\/ld\+json|itemscope/i.test(html);

  let score = 0;
  if (hasEarlyAnswer) score += 25;
  if (hasFaq) score += 20;
  if (hasCitations) score += 20;
  if (hasAuthor) score += 15;
  if (hasSchema) score += 20;

  const promptHints: string[] = [];
  if (!hasEarlyAnswer) promptHints.push('Open with a direct 2–3 sentence answer to the query.');
  if (!hasFaq) promptHints.push('Add a short FAQ block with PAA-style questions.');
  if (!hasCitations) promptHints.push('Cite 2+ authoritative external sources.');
  if (!hasAuthor) promptHints.push('Show clear author attribution.');
  if (!hasSchema) promptHints.push('Add Article/FAQ schema where applicable.');

  return {
    hasEarlyAnswer,
    hasFaq,
    hasCitations,
    hasAuthor,
    hasSchema,
    score,
    promptHints,
  };
}

/** Inject GEO hints into AO system prompts (backend only). */
export function geoPromptBlock(cues: GeoCues): string {
  if (!cues.promptHints.length) return '';
  return ['GEO / AI-citation readiness:', ...cues.promptHints.map((h) => `- ${h}`)].join('\n');
}
