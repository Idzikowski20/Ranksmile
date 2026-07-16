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

const TEMPLATE_BUILDERS_COMMERCIAL: Array<(kw: string) => string> = [
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

/** Generic educational / explainer topics — NOT crime/legal templates. */
const TEMPLATE_BUILDERS_INFORMATIONAL: Array<(kw: string) => string> = [
  (kw) => `Co to jest ${kw.toLowerCase()}?`,
  (kw) => `Czym jest ${kw.toLowerCase()}?`,
  (kw) => `Jakie są rodzaje ${kw.toLowerCase()}?`,
  (kw) => `Jakie są przykłady ${kw.toLowerCase()}?`,
  (kw) => `Jakie są konsekwencje ${kw.toLowerCase()}?`,
  (kw) => `Dlaczego ${kw.toLowerCase()} jest ważne?`,
  (kw) => `Jak przygotować się na ${kw.toLowerCase()}?`,
  (kw) => `Jak rozpoznać ${kw.toLowerCase()}?`,
  (kw) => `Jak działa ${kw.toLowerCase()}?`,
  (kw) => `Co warto wiedzieć o ${kw.toLowerCase()}?`,
  (kw) => `Jakie są przyczyny ${kw.toLowerCase()}?`,
  (kw) => `Jak chronić się przed ${kw.toLowerCase()}?`,
];

/**
 * Crime / harassment / legal-report templates — ONLY for matching keywords (nękanie, stalking…).
 * Never fill these with unrelated topics like "wojna hybrydowa".
 */
const TEMPLATE_BUILDERS_LEGAL: Array<(kw: string) => string> = [
  (kw) => `Co to jest ${kw.toLowerCase()}?`,
  (kw) => `Kiedy można zgłosić ${kw.toLowerCase()}?`,
  (kw) => `Kiedy można oskarżyć o ${kw.toLowerCase()}?`,
  (kw) => `Kiedy można kogoś oskarżyć o ${kw.toLowerCase()}?`,
  (kw) => `Jakie zachowania są uważane za ${kw.toLowerCase()}?`,
  (kw) => `Co to jest ${kw.toLowerCase()} emocjonalne?`,
  (kw) => `Jakie są rodzaje ${kw.toLowerCase()}?`,
  (kw) => `Jakie są konsekwencje ${kw.toLowerCase()}?`,
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
  (kw) => `Jakie są przykłady ${kw.toLowerCase()}?`,
];

const COMMERCIAL_SIGNAL = /\b(warto|polecany|wybrać|wybrac|kosztuje|cennik|opinie|ranking|najlepszy|agencj|detektyw|usług)\b/i;
const INFORMATIONAL_SIGNAL = /\b(co to jest|czym jest|rodzaje|przykłady|konsekwencje|przyczyny|dlaczego|jak działa|jak przygotować)\b/i;
const LEGAL_CRIME_SIGNAL = /\b(nękanie|stalking|molestowanie|przemoc|zgwałcen|oskarżyć|oskarzyc|zgłosić|zglosic|przestępstw|wykrocze|emocjonaln|na policję|na policje|ile grozi)\b/i;
const LEGAL_KEYWORD_SIGNAL = /\b(nękanie|stalking|molestowanie|przemoc domowa|stalker|harassment)\b/i;

/** Labels that only make sense for crime/harassment topics — used to strip stale snapshots. */
export const LEGAL_CRIME_TEMPLATE_RE =
  /\b(kiedy można (zgłosić|zglosic|oskarżyć|oskarzyc)|oskarżyć o|oskarzyc o|zgłosić .+ na policj|zglosic .+ na policj|emocjonalne\?|ile grozi za|wykroczenie czy przestępstwo|dowody są potrzebne w sprawie|postępowanie w sprawie|uporczywe)\b/i;

export type CitationContext = 'commercial' | 'informational' | 'legal';

/** Infer whether citation prompts should be commercial, generic informational, or legal/crime. */
export function detectCitationContext(keyword: string, serpQuestions: string[] = []): CitationContext {
  if (/\b(detektyw|agencj|saas|software|klinik|prawnik|usług detektyw)\b/i.test(keyword)) return 'commercial';
  if (LEGAL_KEYWORD_SIGNAL.test(keyword)) return 'legal';
  let legal = 0;
  let info = 0;
  let comm = 0;
  for (const q of serpQuestions) {
    if (LEGAL_CRIME_SIGNAL.test(q)) legal += 1;
    if (INFORMATIONAL_SIGNAL.test(q)) info += 1;
    if (COMMERCIAL_SIGNAL.test(q)) comm += 1;
  }
  // Real SERP crime questions → legal templates; don't default unrelated topics into crime prompts.
  if (legal >= 2 && legal >= info && legal >= comm) return 'legal';
  if (comm > info && comm > legal) return 'commercial';
  return 'informational';
}

/** Drop crime/legal template rows when the keyword is not a legal topic (fixes imported articles). */
export function isMisalignedLegalCitation(label: string, keyword: string): boolean {
  if (!LEGAL_CRIME_TEMPLATE_RE.test(label)) return false;
  if (LEGAL_KEYWORD_SIGNAL.test(keyword)) return false;
  return true;
}

export function filterMisalignedLegalCitations<T extends { label: string }>(
  items: readonly T[],
  keyword: string,
): T[] {
  return items.filter((i) => !isMisalignedLegalCitation(i.label, keyword));
}

const TEMPLATE_BUILDERS_COMMERCIAL_EN: Array<(kw: string) => string> = [
  (kw) => `Is ${kw.toLowerCase()} worth it?`,
  (kw) => `best ${kw.toLowerCase()}`,
  (kw) => `who should I choose for ${kw.toLowerCase()}?`,
  (kw) => `how to choose ${kw.toLowerCase()}?`,
  (kw) => `how much does ${kw.toLowerCase()} cost?`,
  (kw) => `top ${kw.toLowerCase()}`,
  (kw) => `${kw.toLowerCase()} reviews`,
  (kw) => `is ${kw.toLowerCase()} legal?`,
];

const TEMPLATE_BUILDERS_INFORMATIONAL_EN: Array<(kw: string) => string> = [
  (kw) => `What is ${kw.toLowerCase()}?`,
  (kw) => `What are the types of ${kw.toLowerCase()}?`,
  (kw) => `What are examples of ${kw.toLowerCase()}?`,
  (kw) => `What are the consequences of ${kw.toLowerCase()}?`,
  (kw) => `Why does ${kw.toLowerCase()} matter?`,
  (kw) => `How does ${kw.toLowerCase()} work?`,
  (kw) => `How to prepare for ${kw.toLowerCase()}?`,
  (kw) => `How to recognize ${kw.toLowerCase()}?`,
];

const TEMPLATE_BUILDERS_LEGAL_EN: Array<(kw: string) => string> = [
  (kw) => `What is ${kw.toLowerCase()}?`,
  (kw) => `When can you report ${kw.toLowerCase()}?`,
  (kw) => `What behaviors count as ${kw.toLowerCase()}?`,
  (kw) => `What are the types of ${kw.toLowerCase()}?`,
  (kw) => `What are the consequences of ${kw.toLowerCase()}?`,
  (kw) => `Is ${kw.toLowerCase()} a crime?`,
  (kw) => `How to prove ${kw.toLowerCase()}?`,
  (kw) => `How to report ${kw.toLowerCase()}?`,
];

function templateBuildersForContext(
  context: CitationContext,
  languageCode: string,
): Array<(kw: string) => string> {
  const en = languageCode.toLowerCase().slice(0, 2) === 'en';
  if (en) {
    if (context === 'commercial') return TEMPLATE_BUILDERS_COMMERCIAL_EN;
    if (context === 'legal') return TEMPLATE_BUILDERS_LEGAL_EN;
    return TEMPLATE_BUILDERS_INFORMATIONAL_EN;
  }
  if (context === 'commercial') return TEMPLATE_BUILDERS_COMMERCIAL;
  if (context === 'legal') return TEMPLATE_BUILDERS_LEGAL;
  return TEMPLATE_BUILDERS_INFORMATIONAL;
}

/** @deprecated use templateBuildersForContext — kept as alias for commercial tests */
const TEMPLATE_BUILDERS = TEMPLATE_BUILDERS_COMMERCIAL;

/** Natural-language prompts users ask AI search / Google — targets AI Overview citations. */
export function buildCitationPrompts(
  keyword: string,
  extra: string[] = [],
  max = 15,
  context?: CitationContext,
  languageCode = 'pl',
): string[] {
  const kw = keyword.trim();
  if (!kw) return [];

  const ctx = context ?? detectCitationContext(kw, extra);
  const builders = templateBuildersForContext(ctx, languageCode);

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

  for (const q of extra) {
    if (isMisalignedLegalCitation(q, kw)) continue;
    push(q);
  }
  for (const build of builders) push(build(kw));

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

/** Top citation prompts shown as intent bucket — prefers real SERP/LLM questions (Surfer fan-out style). */
export function citationIntentItems(
  keyword: string,
  headlineQuestion?: string,
  opts?: { serpQuestions?: string[]; languageCode?: string },
): CoverageItem[] {
  const serp = opts?.serpQuestions ?? [];
  const context = detectCitationContext(keyword, serp);
  const extras = [
    ...(headlineQuestion?.trim() ? [headlineQuestion.trim()] : []),
    ...serp,
  ];
  const prompts = buildCitationPrompts(keyword, extras, CITATION_INTENT_COUNT + 2, context, opts?.languageCode || 'pl')
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
