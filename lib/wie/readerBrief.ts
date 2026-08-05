/**
 * WIE Layer 2 — thin ReaderBrief heuristic (not a full Narrative Planner).
 */
export type ReaderBrief = {
  keyword: string;
  searchIntent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  emotion: 'high' | 'medium' | 'low';
  desiredOutcome: string;
};

const HIGH_EMOTION_RE = /szantaż|ofiar|strach|wstyd|zdrad|rozwod|chorob|dług|egzekuc|przemoc|blackmail|fear|shame|scam|fraud/i;
const COMMERCIAL_RE = /kup|cena|best |vs |alternatyw|pricing|buy|cheap|narzędzi/i;

export function buildHeuristicReaderBrief(opts: {
  keyword: string;
  title?: string;
  paa?: string[];
}): ReaderBrief {
  const blob = `${opts.keyword} ${opts.title || ''} ${(opts.paa || []).join(' ')}`;
  const emotion = HIGH_EMOTION_RE.test(blob) ? 'high' : 'medium';
  const searchIntent = COMMERCIAL_RE.test(blob) ? 'commercial' : 'informational';
  const desiredOutcome =
    emotion === 'high'
      ? 'Feel understood, know what to do next, trust an expert path.'
      : 'Get a clear answer and actionable steps without fluff.';

  return {
    keyword: opts.keyword.trim(),
    searchIntent,
    emotion,
    desiredOutcome,
  };
}

export function formatReaderBriefForPrompt(b: ReaderBrief | null | undefined): string {
  if (!b?.keyword) return '';
  return [
    'READER:',
    `- Intent: ${b.searchIntent}; emotion: ${b.emotion}`,
    `- Desired outcome: ${b.desiredOutcome}`,
    '- Address the reader directly when natural; avoid encyclopedic tone.',
  ].join('\n');
}
