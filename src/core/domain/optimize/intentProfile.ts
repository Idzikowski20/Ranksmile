/**
 * Article intent boundary for Precision AO.
 * Allowed subtopics = what the article already is + likely user need.
 * Commercial denylist = safety net, not the whole boundary.
 */
export type CommercialIntent = 'none' | 'soft' | 'strong';
export type SensitiveDomain = 'health' | 'psychology' | 'legal' | 'finance';

export type ArticleIntentProfile = {
  primaryTopic: string;
  primaryIntent: string;
  allowedSubtopics: string[];
  forbiddenSubtopics: string[];
  commercialIntent: CommercialIntent;
  sensitiveDomain?: SensitiveDomain;
  confidence: number;
};

/** Commercial / investigation drift seeds (PL + EN). */
export const COMMERCIAL_DRIFT_TERMS = [
  'detektyw',
  'detektywistyczn',
  'tester wierności',
  'tester wiernosci',
  'agencja detektyw',
  'śledztwo prywatne',
  'sledztwo prywatne',
  'loyalty test',
  'private investigator',
  'hire a detective',
  'sprawdzić partnera za pieniądze',
] as const;

const PSYCH_HINTS = ['psycholog', 'zaburzen', 'terapi', 'klinicz', 'cuckold', 'zdrad', 'seksual'];
const LEGAL_HINTS = ['prawnik', 'rozwód', 'rozwod', 'kodeks', 'ustaw'];
const HEALTH_HINTS = ['objaw', 'lekarz', 'chorob', 'diagnosz', 'medycyn'];
const FINANCE_HINTS = ['kredyt', 'inwestyc', 'podatek', 'ubezpieczen'];

function tokenize(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

function unique(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const k = x.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function detectSensitiveDomain(text: string): SensitiveDomain | undefined {
  const t = text.toLowerCase();
  if (PSYCH_HINTS.some((h) => t.includes(h))) return 'psychology';
  if (LEGAL_HINTS.some((h) => t.includes(h))) return 'legal';
  if (HEALTH_HINTS.some((h) => t.includes(h))) return 'health';
  if (FINANCE_HINTS.some((h) => t.includes(h))) return 'finance';
  return undefined;
}

export type BuildIntentProfileInput = {
  keyword: string;
  title?: string;
  headings?: string[];
  plainText?: string;
  paaQuestions?: string[];
};

/** Heuristic P0 profile — no LLM. */
export function buildIntentProfile(input: BuildIntentProfileInput): ArticleIntentProfile {
  const keyword = (input.keyword || '').trim();
  const title = (input.title || '').trim();
  const headings = input.headings || [];
  const paa = input.paaQuestions || [];
  const bodyTokens = tokenize((input.plainText || '').slice(0, 4000));

  const allowed = unique([
    ...tokenize(keyword),
    ...tokenize(title),
    ...headings.flatMap((h) => tokenize(h)),
    ...paa.flatMap((q) => tokenize(q)).slice(0, 40),
    ...bodyTokens.slice(0, 80),
    keyword.toLowerCase(),
    title.toLowerCase(),
  ]).filter((t) => t.length >= 3);

  const forbidden = unique([
    ...COMMERCIAL_DRIFT_TERMS.map((t) => t.toLowerCase()),
  ]);

  const blob = `${keyword} ${title} ${headings.join(' ')}`;
  const sensitiveDomain = detectSensitiveDomain(blob);

  return {
    primaryTopic: keyword || title || 'article',
    primaryIntent: 'informational',
    allowedSubtopics: allowed,
    forbiddenSubtopics: forbidden,
    commercialIntent: 'none',
    sensitiveDomain,
    confidence: keyword ? 0.7 : 0.4,
  };
}

export function textHitsForbidden(text: string, profile: ArticleIntentProfile): boolean {
  const low = text.toLowerCase();
  return profile.forbiddenSubtopics.some((f) => low.includes(f));
}
