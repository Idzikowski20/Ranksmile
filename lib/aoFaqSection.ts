import type { CoverageItem } from './aiCoverage';
import { STOP_SLOP_RULES } from './stopSlopPrompt';

const FAQ_HEADING_RE = /<h2[^>]*>\s*(faq|najcz[eę]ściej zadawane pytania|frequently asked questions|pytania i odpowiedzi)\s*<\/h2>/i;

export interface UncoveredAiQuestion {
  id: string;
  label: string;
}

export function collectUncoveredAiQuestions(items: readonly CoverageItem[]): UncoveredAiQuestion[] {
  return items
    .filter((i) =>
      (i.category === 'intent' || i.category === 'knowledge')
      && (i.type === 'paa' || i.type === 'fact' || i.type === 'intent' || i.type === 'definition' || i.type === 'comparison')
      && (!i.covered || i.quality < 4),
    )
    .map((i) => ({ id: i.id, label: i.label }));
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

${STOP_SLOP_RULES}`;

  const userInstruction = `Target keyword: "${opts.keyword}"

Answer ALL of these AI Search questions in the FAQ section:
${qList}

Article context (excerpt):
${opts.articleExcerpt.slice(-2000)}

Return ONLY the FAQ HTML block.`;

  return { systemPrompt, userInstruction };
}
