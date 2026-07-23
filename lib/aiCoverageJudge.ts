/**
 * Server-only coverage judge (DeepSeek via LLM Gateway).
 * Kept out of lib/aiCoverage.ts so client pages can import computeCoverageScores
 * without pulling sqlite3 / fs into the browser bundle.
 */
import {
  sanitizeVerdict,
  type CoverageJudge,
  type CoverageVerdict,
} from './aiCoverage';
import { safeJsonParse } from './safeJson';
import { llmGateway } from './llmGateway';

const COVERAGE_MODEL = 'deepseek-chat';
const COVERAGE_TEMPERATURE = 0;
const COVERAGE_PROMPT_VERSION = 'v1';

/** Default judge: one deepseek-chat call via LLM Gateway. */
export const deepseekJudge: CoverageJudge = {
  version: `${COVERAGE_PROMPT_VERSION}|${COVERAGE_MODEL}|${COVERAGE_TEMPERATURE}`,
  run: async (plainText, items) => {
    const list = items.map((i) => `- ${i.id} [${i.type}]: ${i.label}`).join('\n');
    const system = 'You are an SEO topic-coverage auditor. Judge ONLY from the article. Reply ONLY with JSON.';
    const user =
      `Knowledge items to cover:\n${list}\n\n` +
      'For each id return: covered(bool), quality(0-5: 5=thorough explanation, 1=bare mention), ' +
      'confidence(0-1: your confidence in this verdict), needsExpansion(bool: covered but too shallow), ' +
      'missing(string[] of specific facts/sub-points still absent), ' +
      'reason(short string: WHY uncovered or shallow — e.g. "answer hidden mid-section", "fact too vague", ' +
      '"no statistics", "too generic"), ' +
      'sectionId(the id/heading covering it, if covered). Also answersMainQuestionEarly(bool): ' +
      'does the FIRST paragraph directly answer the main question?\n' +
      'JSON: {"items":[{"id","covered","quality","confidence","needsExpansion","missing":[],"reason","sectionId"}],' +
      '"answersMainQuestionEarly"}.\n\n=== ARTICLE ===\n' + plainText + '\n=== END ===';
    const gw = await llmGateway({
      provider: 'deepseek',
      model: COVERAGE_MODEL,
      temperature: COVERAGE_TEMPERATURE,
      seed: 7,
      responseFormat: 'json_object',
      maxTokens: 4000,
      jobType: 'coverage_judge',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const parsed = safeJsonParse<{ items?: CoverageVerdict[]; answersMainQuestionEarly?: boolean }>(
      gw.text ?? '',
      {},
    );
    return { items: sanitizeVerdict(parsed.items), answersMainQuestionEarly: !!parsed.answersMainQuestionEarly };
  },
};
