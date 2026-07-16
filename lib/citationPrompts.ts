import type { CoverageItem } from './aiCoverage';
import { hashId } from './aiCoverage';
import { isNewCoverageIdsEnabled } from './featureFlags';
import { normalizeTerm } from './termUtils';
import { isKeywordOnTopic, seedTokens } from './topicRelevance';

export const CITATION_INTENT_COUNT = 8;

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

/** Retired crime/legal fill-ins — strip from snapshots when keyword is not a legal topic. */
export const LEGAL_CRIME_TEMPLATE_RE =
  /\b(kiedy można (zgłosić|zglosic|oskarżyć|oskarzyc)|oskarżyć o|oskarzyc o|zgłosić .+ na policj|zglosic .+ na policj|emocjonalne\?|ile grozi za|wykroczenie czy przestępstwo|dowody są potrzebne w sprawie|postępowanie w sprawie|uporczywe)\b/i;

const LEGAL_KEYWORD_SIGNAL = /\b(nękanie|stalking|molestowanie|przemoc domowa|stalker|harassment)\b/i;

/** Exact fill of a retired template for this keyword (legacy snapshots only). */
const LEGACY_SYNTHETIC_BUILDERS: Array<(kw: string) => string> = [
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
  (kw) => `kiedy warto skorzystać z ${kw.toLowerCase()}?`,
  (kw) => `Kiedy można zgłosić ${kw.toLowerCase()}?`,
  (kw) => `Kiedy można oskarżyć o ${kw.toLowerCase()}?`,
  (kw) => `Kiedy można kogoś oskarżyć o ${kw.toLowerCase()}?`,
  (kw) => `Jakie zachowania są uważane za ${kw.toLowerCase()}?`,
  (kw) => `Co to jest ${kw.toLowerCase()} emocjonalne?`,
  (kw) => `Czy ${kw.toLowerCase()} jest przestępstwem?`,
  (kw) => `Jak udowodnić ${kw.toLowerCase()}?`,
  (kw) => `Czym jest uporczywe ${kw.toLowerCase()}?`,
  (kw) => `Jak zgłosić ${kw.toLowerCase()} na policję?`,
  (kw) => `Czy ${kw.toLowerCase()} to wykroczenie czy przestępstwo?`,
  (kw) => `Jakie dowody są potrzebne w sprawie ${kw.toLowerCase()}?`,
  (kw) => `Ile grozi za ${kw.toLowerCase()}?`,
  (kw) => `Gdzie zgłosić ${kw.toLowerCase()}?`,
  (kw) => `Jak długo trwa postępowanie w sprawie ${kw.toLowerCase()}?`,
  (kw) => `Czy ${kw.toLowerCase()} w pracy jest legalne?`,
];

export function isLikelySyntheticCitationTemplate(label: string, keyword: string): boolean {
  const kw = keyword.trim();
  if (!kw || !label.trim()) return false;
  const key = normalizeTerm(label);
  return LEGACY_SYNTHETIC_BUILDERS.some((build) => normalizeTerm(build(kw)) === key);
}

/**
 * Drop retired template fills from stored snapshots.
 * Keeps real SERP questions (including for nękanie) — only removes exact keyword-template fills
 * and crime-wording on non-legal topics.
 */
export function isMisalignedSyntheticCitation(label: string, keyword: string): boolean {
  if (LEGAL_CRIME_TEMPLATE_RE.test(label) && !LEGAL_KEYWORD_SIGNAL.test(keyword)) return true;
  if (isLikelySyntheticCitationTemplate(label, keyword) && !LEGAL_KEYWORD_SIGNAL.test(keyword)) return true;
  return false;
}

export function filterSyntheticCitationTemplates<T extends { label: string }>(
  items: readonly T[],
  keyword: string,
): T[] {
  return items.filter((i) => !isMisalignedSyntheticCitation(i.label, keyword));
}

/** @deprecated alias */
export function filterMisalignedLegalCitations<T extends { label: string }>(
  items: readonly T[],
  keyword: string,
): T[] {
  return filterSyntheticCitationTemplates(items, keyword);
}

/**
 * Rank / dedupe real SERP (DataForSEO / Serper) questions for AI Cover.
 * Never invents prompts — `extra` must come from PAA / related / SERP scrape.
 */
export function buildCitationPrompts(
  keyword: string,
  extra: string[] = [],
  max = 15,
): string[] {
  const kw = keyword.trim();
  if (!kw) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of extra) {
    const q = raw.replace(/\s+/g, ' ').trim();
    const key = normalizeTerm(q);
    if (!key || key.length < 8 || seen.has(key)) continue;
    if (!isUsefulCitationPrompt(q, kw)) continue;
    seen.add(key);
    out.push(q);
    if (out.length >= max) break;
  }

  return out;
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

/**
 * Intent bucket from real SERP questions only (DataForSEO PAA / Serper / related).
 * No keyword templates. Empty SERP → empty intent list.
 */
export function citationIntentItems(
  keyword: string,
  _headlineQuestion?: string,
  opts?: { serpQuestions?: string[]; languageCode?: string },
): CoverageItem[] {
  const serp = opts?.serpQuestions ?? [];
  const prompts = buildCitationPrompts(keyword, serp, CITATION_INTENT_COUNT);

  return prompts.map((label, index) => ({
    id: citationItemId(label, 'intent'),
    label,
    type: 'intent' as const,
    category: 'intent' as const,
    importance: index < 2 ? ('critical' as const) : ('recommended' as const),
    source: 'paa' as const,
    covered: false,
    quality: 0,
  }));
}
