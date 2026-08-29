/**
 * Enforce WIE opening policy on final HTML (Expected → Observed).
 * Used by AO after edit loop and by Writer judge.
 */
import { splitSections } from '@/src/infrastructure/articles/articleSections';
import { detectOpeningStyle, type OpeningStyle } from '@/src/infrastructure/wie/eval/policyCompliance';

export type OpeningEnforcementResult = {
  html: string;
  tokens: number;
  attempted: boolean;
  before: OpeningStyle;
  after: OpeningStyle;
  /** Still violates expected problem_first */
  violated: boolean;
  method: 'none' | 'llm' | 'heuristic';
};

/** True when expected opening is problem_first but HTML lead is not.
 *
 * `unknown` is NOT a violation. The detector is a handful of regexes, and a lead that
 * answers the query directly ("Jestem szantażowany? Nie płać…") matches none of them —
 * counting that as a violation made the enforcement below REPLACE a correct early
 * answer with the canned hook, which then also failed the coverage judge's
 * answersMainQuestionEarly. Only a positively detected definition-style lead violates. */
export function openingPolicyViolated(html: string, expectedOpening?: string | null): boolean {
  if (!expectedOpening || expectedOpening !== 'problem_first') return false;
  const obs = detectOpeningStyle(html);
  return obs === 'definition_first' || obs === 'mixed';
}

export function buildOpeningRewritePrompt(opts: {
  sectionHtml: string;
  keyword?: string;
}): string {
  const kw = (opts.keyword || '').trim() || 'temat';
  return [
    'You are fixing a POLICY VIOLATION on the article opening.',
    'POLICY: opening = problem_first (HARD — non-negotiable).',
    `Keyword/context: ${kw}`,
    '',
    'Rewrite the FIRST body paragraph (and only what is needed in this section) so it:',
    '1. Opens with the reader’s situation or stakes (problem-first) — one short clause.',
    '2. ANSWERS the query directly within the first two sentences. If the paragraph',
    '   already contains the answer, it must survive the rewrite — never trade it for the hook.',
    '3. Does NOT start with a dictionary/Wikipedia definition (“X to…”, “X jest…”, “definicja”).',
    '4. Never quotes the raw keyword in quotation marks; use its natural inflected form.',
    '5. Keeps factual accuracy; no fake credentials.',
    '6. Polish language if the section is Polish.',
    '',
    'Good lead pattern: situation → direct answer → what the article covers.',
    'Bad lead pattern: “Szantaż to zmuszanie…” / “X jest przestępstwem polegającym…”.',
    '',
    'Return the FULL updated section HTML only.',
    '',
    'SECTION HTML:',
    opts.sectionHtml,
  ].join('\n');
}

/**
 * Last-resort: add a problem-first hook when the article has NO lead paragraph at all.
 *
 * It used to REPLACE the writer's first <p> — often the direct answer the AI score
 * demands — with this canned hook, quoting the raw keyword. Every article that hit it
 * opened with the identical template sentence and lost its early answer. A lead that
 * exists but reads wrong is the LLM path's job; the heuristic only fills a void.
 * ponytail: generic PL hook — upgrade path = brand DNA opening templates.
 */
export function heuristicProblemFirstInject(html: string, keyword?: string): string {
  const kw = (keyword || 'tym problemem').trim();
  const hook =
    `<p>Czujesz, że ktoś naciska na Ciebie w sprawie „${kw}" i nie wiesz, od czego zacząć? `
    + 'Najpierw spokój i plan — poniżej konkretne kroki, zanim przejdziemy do definicji i prawa.</p>';

  if (/<p\b[^>]*>[\s\S]*?<\/p>/i.test(html)) {
    return html;
  }
  if (/<h1\b/i.test(html)) {
    return html.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/i, `$1\n${hook}`);
  }
  return `${hook}\n${html}`;
}

/**
 * If policy requires problem_first and lead violates it: LLM rewrite first section, else heuristic.
 */
export async function enforceOpeningPolicy(opts: {
  html: string;
  expectedOpening?: string | null;
  keyword?: string;
  llmEdit?: (prompt: string) => Promise<{ html: string; tokens: number }>;
}): Promise<OpeningEnforcementResult> {
  const before = detectOpeningStyle(opts.html);
  const expected = opts.expectedOpening || null;

  if (!openingPolicyViolated(opts.html, expected)) {
    return {
      html: opts.html,
      tokens: 0,
      attempted: false,
      before,
      after: before,
      violated: false,
      method: 'none',
    };
  }

  let html = opts.html;
  let tokens = 0;
  let method: OpeningEnforcementResult['method'] = 'none';

  const sections = splitSections(html);
  const lead = sections[0];

  if (lead && opts.llmEdit) {
    try {
      const r = await opts.llmEdit(buildOpeningRewritePrompt({
        sectionHtml: lead.html,
        keyword: opts.keyword,
      }));
      tokens += r.tokens;
      const afterHtml = (r.html || '').trim();
      if (afterHtml && afterHtml !== lead.html.trim()) {
        const idx = html.indexOf(lead.html);
        html = idx >= 0
          ? html.slice(0, idx) + afterHtml + html.slice(idx + lead.html.length)
          : [afterHtml, ...sections.slice(1).map((s) => s.html)].join('\n');
        method = 'llm';
      }
    } catch {
      /* fall through to heuristic */
    }
  }

  if (openingPolicyViolated(html, expected)) {
    html = heuristicProblemFirstInject(html, opts.keyword);
    method = 'heuristic';
  }

  const after = detectOpeningStyle(html);
  return {
    html,
    tokens,
    attempted: true,
    before,
    after,
    violated: openingPolicyViolated(html, expected),
    method,
  };
}

/** Hard lines for Writer / AO prompts when opening policy is problem_first. */
export function openingPolicyHardRules(expectedOpening?: string | null): string {
  if (expectedOpening !== 'problem_first') return '';
  return [
    'HARD OPENING POLICY (must obey):',
    '- opening:problem_first — first paragraph MUST start with reader problem/stakes/emotion.',
    '- FORBIDDEN first sentence patterns: “X to…”, “X jest…”, “Definicja…”, dictionary leads.',
    '- If you explain what X is, do it AFTER the problem hook — never as the lead.',
  ].join('\n');
}

export { detectOpeningStyle };
export type { OpeningStyle };
