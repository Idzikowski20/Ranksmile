import type { CoverageItem } from './aiCoverage';
import { hashId } from './aiCoverage';
import { isNewCoverageIdsEnabled } from './featureFlags';
import { normalizeTerm } from './termUtils';
import { isKeywordOnTopic, seedTokens } from './topicRelevance';

export const CITATION_INTENT_COUNT = 5;

/** Stable coverage item id for a citation prompt — bucket-aware when ENABLE_NEW_COVERAGE_IDS. */
export function citationItemId(label: string, bucket: 'paa' | 'intent'): string {
  const hash = hashId(label);
  if (isNewCoverageIdsEnabled()) {
    return bucket === 'intent' ? `intent-citation-${hash}` : `paa-citation-${hash}`;
  }
  return `citation-${hash}`;
}

/** Legacy `citation-*` ids shared across buckets — map to bucket-specific ids when flag is on. */
export function remapLegacyCitationItem(item: CoverageItem): CoverageItem {
  if (!isNewCoverageIdsEnabled()) return item;
  if (!item.id.startsWith('citation-') || item.id.startsWith('paa-citation-') || item.id.startsWith('intent-citation-')) {
    return item;
  }
  const bucket: 'paa' | 'intent' = item.type === 'intent' || item.category === 'intent' ? 'intent' : 'paa';
  return { ...item, id: citationItemId(item.label, bucket) };
}

const TEMPLATE_BUILDERS: Array<(kw: string) => string> = [
  (kw) => `${kw} czy warto?`,
  (kw) => `polecany ${kw.toLowerCase()}`,
  (kw) => `${kw} kogo wybrać?`,
  (kw) => `jak wybrać ${kw.toLowerCase()}?`,
  (kw) => `ile kosztuje ${kw.toLowerCase()}?`,
  (kw) => `najlepszy ${kw.toLowerCase()}`,
  (kw) => `${kw} opinie`,
  (kw) => `czy ${kw.toLowerCase()} jest legalny?`,
  (kw) => `jak znaleźć dobrego ${kw.toLowerCase()}?`,
  (kw) => `${kw} ranking`,
  (kw) => `co to jest ${kw.toLowerCase()}?`,
  (kw) => `kiedy warto skorzystać z ${kw.toLowerCase()}?`,
];

/** Natural-language prompts users ask AI search / Google — targets AI Overview citations. */
export function buildCitationPrompts(keyword: string, extra: string[] = [], max = 15): string[] {
  const kw = keyword.trim();
  if (!kw) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    const q = raw.replace(/\s+/g, ' ').trim();
    const key = normalizeTerm(q);
    if (!key || key.length < 8 || seen.has(key)) return;
    if (!isUsefulCitationPrompt(q, kw)) return;
    seen.add(key);
    out.push(q);
  };

  for (const build of TEMPLATE_BUILDERS) push(build(kw));
  for (const q of extra) push(q);

  return out.slice(0, max);
}

/** Question-shaped prompts worth tracking for AI visibility (not page boilerplate). */
export function isUsefulCitationPrompt(text: string, keyword: string): boolean {
  const q = text.trim();
  if (q.length < 10 || q.length > 120) return false;
  if (/\b(http|www\.|@|\.pl\/|\.com\/)\b/i.test(q)) return false;
  if (!isKeywordOnTopic(q, keyword)) {
    const seeds = seedTokens(keyword);
    const words = normalizeTerm(q).split(/\s+/);
    const overlap = seeds.filter((s) => words.includes(s)).length;
    if (overlap < 1) return false;
  }
  if (/^(answer|set expectations|identify who|explain why)/i.test(q)) return false;
  return isCitationStyleQuestion(q) || /\?/.test(q);
}

export function isCitationStyleQuestion(text: string): boolean {
  const q = text.trim();
  if (!q) return false;
  if (/\?\s*$/.test(q)) return true;
  return /^(czy|jak|ile|kiedy|gdzie|dlaczego|co to jest|jaki|jaka|jakie|najlepsz|polecany|ranking)\b/i.test(q);
}

export function scoreCitationPrompt(question: string, keyword: string): number {
  const q = question.trim();
  if (!isUsefulCitationPrompt(q, keyword)) return 0;

  let score = 40;
  if (isKeywordOnTopic(q, keyword)) score += 35;
  if (isCitationStyleQuestion(q)) score += 20;
  if (/\b(warto|polecany|wybrać|wybrac|kosztuje|cennik|opinie|najlepsz)\b/i.test(q)) score += 15;
  if (q.length > 90) score -= 10;
  return score;
}

/** Top citation prompts shown as intent bucket — real queries, not writing-coach labels. */
export function citationIntentItems(keyword: string, headlineQuestion?: string): CoverageItem[] {
  const extras = headlineQuestion?.trim() ? [headlineQuestion.trim()] : [];
  const prompts = buildCitationPrompts(keyword, extras, CITATION_INTENT_COUNT + 2)
    .slice(0, CITATION_INTENT_COUNT);

  return prompts.map((label, index) => ({
    id: citationItemId(label, 'intent'),
    label,
    type: 'intent' as const,
    category: 'intent' as const,
    importance: index < 2 ? ('critical' as const) : ('recommended' as const),
    source: 'llm' as const,
    covered: false,
    quality: 0,
  }));
}
