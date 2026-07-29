import type { CoverageItem } from './aiCoverage';
import { isUncoveredAiSearchItem } from './aiCoverage';
import { STOP_SLOP_RULES } from './stopSlopPrompt';
import type { ArticleIntentProfile } from './ao/intentProfile';
import { textHitsForbidden } from './ao/intentProfile';
import { scoreCandidateAgainstProfile } from './ao/intentGuard';
import { makeCandidate } from './ao/editCandidate';

const FAQ_HEADING_RE = /<h2[^>]*>\s*(faq|najcz[eę]ściej zadawane pytania|frequently asked questions|pytania i odpowiedzi)\s*<\/h2>/i;

export interface UncoveredAiQuestion {
  id: string;
  label: string;
}

/** Length-based FAQ budget (safety cap, not a target). */
export function faqBudgetForWordCount(wordCount: number): number {
  if (wordCount < 800) return 2;
  if (wordCount < 1500) return 3;
  if (wordCount < 2500) return 4;
  return 5;
}

export function countPlainWords(text: string): number {
  return (text || '').split(/\s+/).filter(Boolean).length;
}

export function collectUncoveredAiQuestions(items: readonly CoverageItem[]): UncoveredAiQuestion[] {
  return items
    .filter(isUncoveredAiSearchItem)
    .map((i) => ({ id: i.id, label: i.label }));
}

/**
 * FAQ gate: IntentGuard + unanswered + non-redundant + length budget.
 * High intentFit fills budget; does not dump all uncovered.
 */
export function selectFaqQuestions(opts: {
  questions: UncoveredAiQuestion[];
  profile: ArticleIntentProfile;
  articlePlainText: string;
  maxQuestions?: number;
}): UncoveredAiQuestion[] {
  const budget = opts.maxQuestions ?? faqBudgetForWordCount(countPlainWords(opts.articlePlainText));
  const plainLow = opts.articlePlainText.toLowerCase();
  const selected: UncoveredAiQuestion[] = [];
  const seen = new Set<string>();

  for (const q of opts.questions) {
    if (selected.length >= budget) break;
    const label = (q.label || '').trim();
    if (label.length < 8) continue;
    if (textHitsForbidden(label, opts.profile)) continue;

    const key = label.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;

    // Redundant if question tokens already answered in body
    const tokens = key.split(/\s+/).filter((w) => w.length > 3);
    const hitRatio = tokens.length
      ? tokens.filter((t) => plainLow.includes(t)).length / tokens.length
      : 0;
    if (hitRatio >= 0.85) continue;

    const scored = scoreCandidateAgainstProfile(
      makeCandidate({
        id: q.id,
        source: 'paa',
        targetGap: label,
        priority: 'recommended',
        intentFit: 0.5,
      }),
      opts.profile,
    );
    if (scored.commercialDrift > 0.5 || scored.intentFit < 0.45) continue;

    seen.add(key);
    selected.push({ id: q.id, label });
  }

  return selected;
}

export function detectFaqSectionStart(html: string): number | null {
  const m = FAQ_HEADING_RE.exec(html);
  return m ? m.index : null;
}

export function mergeFaqHtml(articleHtml: string, faqHtml: string): string {
  const trimmedFaq = faqHtml.trim();
  if (!trimmedFaq) return articleHtml;

  const start = detectFaqSectionStart(articleHtml);
  if (start != null) {
    return `${articleHtml.slice(0, start).trimEnd()}\n${trimmedFaq}`;
  }
  return `${articleHtml.trimEnd()}\n\n${trimmedFaq}`;
}

export function buildFaqSectionPrompt(opts: {
  keyword: string;
  questions: string[];
  articleExcerpt: string;
  language: string;
}): { systemPrompt: string; userInstruction: string } {
  const isPl = opts.language === 'pl' || /[ąćęłńóśźż]/i.test(opts.questions.join(' '));
  const heading = isPl ? 'Najczęściej zadawane pytania' : 'FAQ';
  const qList = opts.questions.map((q) => `- ${q}`).join('\n');

  const systemPrompt = `You are an expert SEO content editor. Output ONLY raw HTML for a FAQ section.

RULES:
- Start with <h2>${heading}</h2>
- For EACH question below: one <h3> with the exact question text, then one <p> answer
- Each <p> answer: 120–350 characters of plain text. Be factual and concise; do not invent fake Q&A stubs.
- Do NOT wrap in markdown fences. No commentary outside HTML.
- Match the article language (${opts.language}).
- Answer ALL ${opts.questions.length} questions — none may be skipped.
- Do NOT introduce commercial services (detectives, loyalty testers, paid investigation).

${STOP_SLOP_RULES}`;

  const userInstruction = `Target keyword: "${opts.keyword}"

Answer ALL of these AI Search questions in the FAQ section:
${qList}

Article context (excerpt):
${opts.articleExcerpt.slice(-2000)}

Return ONLY the FAQ HTML block.`;

  return { systemPrompt, userInstruction };
}
