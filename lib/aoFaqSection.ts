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

    // Redundant if content tokens (minus stopwords) are already in body
    const STOP = new Set([
      'czym', 'jaka', 'jaki', 'jakie', 'jak', 'dlaczego', 'czy', 'co', 'to',
      'jest', 'są', 'oraz', 'what', 'when', 'where', 'which', 'does',
      'the', 'and', 'for', 'with', 'from', 'znaczy', 'oznacza',
    ]);
    const tokens = key
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]+/gu, ''))
      .filter((w) => w.length > 3 && !STOP.has(w));
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

export type FaqStructureValidation =
  | { ok: true; questionCount: number }
  | { ok: false; reason: string };

const FAQ_H2_PL = /najcz[eę]ściej zadawane pytania|pytania i odpowiedzi/i;
const FAQ_H2_EN = /\bfaq\b|frequently asked questions/i;
const MIN_ANSWER_CHARS = 40;
const MAX_ANSWER_CHARS = 500;
/** Single paragraph longer than this without H3 structure = wall of text. */
const WALL_OF_TEXT_CHARS = 600;

/**
 * Hard structural gate for AO FAQ HTML. Score gates alone are not enough —
 * wall-of-text dumps must fail even if AI coverage rises.
 */
export function validateFaqHtmlStructure(
  html: string,
  opts?: { language?: string; expectedQuestionCount?: number },
): FaqStructureValidation {
  const trimmed = (html || '').trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  const h2Matches = [...trimmed.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  if (h2Matches.length !== 1) {
    return { ok: false, reason: h2Matches.length === 0 ? 'missing_h2' : 'multiple_h2' };
  }
  const h2Text = h2Matches[0][1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const isPl = opts?.language === 'pl' || FAQ_H2_PL.test(h2Text);
  if (isPl && !FAQ_H2_PL.test(h2Text)) {
    return { ok: false, reason: 'pl_heading_required' };
  }
  if (!isPl && !FAQ_H2_EN.test(h2Text) && !FAQ_H2_PL.test(h2Text)) {
    return { ok: false, reason: 'invalid_faq_heading' };
  }

  const h3Matches = [...trimmed.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)];
  if (h3Matches.length < 1) {
    // Wall of text: one giant paragraph, no questions
    const plain = trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (plain.length >= WALL_OF_TEXT_CHARS) {
      return { ok: false, reason: 'wall_of_text' };
    }
    return { ok: false, reason: 'missing_h3' };
  }

  // Each H3 must be followed by a non-empty <p> before the next H3/H2/end
  for (let i = 0; i < h3Matches.length; i++) {
    const h3 = h3Matches[i];
    const start = (h3.index ?? 0) + h3[0].length;
    const end = i + 1 < h3Matches.length
      ? (h3Matches[i + 1].index ?? trimmed.length)
      : trimmed.length;
    const between = trimmed.slice(start, end);
    const pMatch = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(between);
    if (!pMatch) return { ok: false, reason: 'h3_without_p' };
    const answer = pMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (answer.length < MIN_ANSWER_CHARS) return { ok: false, reason: 'answer_too_short' };
    if (answer.length > MAX_ANSWER_CHARS) return { ok: false, reason: 'answer_too_long' };
  }

  // Reject leading/orphan wall text after H2 before first H3
  const afterH2 = trimmed.slice((h2Matches[0].index ?? 0) + h2Matches[0][0].length);
  const beforeFirstH3 = afterH2.slice(0, afterH2.search(/<h3\b/i));
  const orphanPlain = beforeFirstH3.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (orphanPlain.length >= WALL_OF_TEXT_CHARS) {
    return { ok: false, reason: 'wall_of_text' };
  }

  if (
    opts?.expectedQuestionCount != null
    && opts.expectedQuestionCount > 0
    && h3Matches.length !== opts.expectedQuestionCount
  ) {
    return { ok: false, reason: 'question_count_mismatch' };
  }

  return { ok: true, questionCount: h3Matches.length };
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
