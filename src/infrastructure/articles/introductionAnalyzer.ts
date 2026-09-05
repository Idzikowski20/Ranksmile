import { CoverageItem, intentItems } from '@/src/core/domain/coverage/aiCoverage';
import { safeJsonParse } from '@/src/core/shared/safeJson';
import { llmGateway } from '@/src/infrastructure/ai/llmGateway';

export interface IntroVerdict {
  intentConfirmed: boolean;
  answerStartsEarly: boolean;
  audienceMentioned: boolean;
  goalMentioned: boolean;
  expectationsSet: boolean;
  detectedMainQuestion?: string;
  notes?: Record<string, string>;
}

export interface IntroductionJudge {
  version: string;
  run: (introText: string, targetKeyword: string) => Promise<IntroVerdict>;
}

const SAFE_DEFAULT: IntroVerdict = {
  intentConfirmed: false, answerStartsEarly: false,
  audienceMentioned: false, goalMentioned: false, expectationsSet: false,
};

export async function analyzeIntroduction(
  introText: string, targetKeyword: string, judge: IntroductionJudge,
): Promise<IntroVerdict> {
  if (!introText.trim()) return SAFE_DEFAULT;
  try {
    return await judge.run(introText, targetKeyword);
  } catch (err) {
    // All-false is indistinguishable from a genuine "the intro does none of this", and
    // it costs the 15-point early-answer bonus plus the whole intent bucket. An article
    // whose lead answered the question directly scored answersMainQuestionEarly=false
    // for weeks because the judge's provider was returning 402 and nobody could see it.
    console.error('[intro-judge] failed, scoring the intro as all-false:', err);
    return SAFE_DEFAULT;
  }
}

/** Map the intro verdict onto the 5 fixed CoverageItem rows from intentItems(). */
export function introCoverageItems(verdict: IntroVerdict): CoverageItem[] {
  const map: Record<string, boolean> = {
    'intent-answer-main': verdict.intentConfirmed,
    'intent-answer-early': verdict.answerStartsEarly,
    'intent-expectations': verdict.expectationsSet,
    'intent-who': verdict.audienceMentioned,
    'intent-why': verdict.goalMentioned,
  };
  return intentItems().map((it) => {
    const covered = !!map[it.id];
    return { ...it, covered, quality: covered ? 5 : 0 };
  });
}

// No model pin: it is the gateway's job to name the model each provider in the chain
// actually serves. "deepseek-chat" was sent verbatim to OpenRouter, which does not have
// it, so every call failed past OpenRouter and landed on the Gemini fallback.
const INTRO_MODEL = 'gateway-default';
const INTRO_TEMPERATURE = 0;
const INTRO_PROMPT_VERSION = 'v1';

export const deepseekIntroJudge: IntroductionJudge = {
  version: `${INTRO_PROMPT_VERSION}|${INTRO_MODEL}|${INTRO_TEMPERATURE}`,
  run: async (introText, targetKeyword) => {
    const system = 'You analyze the FIRST ~500 words of an SEO article. Reply ONLY with JSON.';
    const user = `Target keyword: "${targetKeyword}"\n\n`
      + 'For the intro below, return JSON {'
      + '"intentConfirmed": bool, "answerStartsEarly": bool, '
      + '"audienceMentioned": bool, "goalMentioned": bool, "expectationsSet": bool, '
      + '"detectedMainQuestion": string}\n\n'
      + 'Criteria:\n'
      + '- intentConfirmed: the intro names what this article delivers about the keyword\n'
      + '- answerStartsEarly: the first paragraph directly answers the main question (not background)\n'
      + '- audienceMentioned: the intro identifies who the reader is\n'
      + '- goalMentioned: the intro explains why this matters / what the reader gains\n'
      + '- expectationsSet: the intro previews the article structure or scope\n\n'
      + `=== INTRO ===\n${introText}\n=== END ===`;
    // Through the gateway, like the coverage judge next to it: the direct DeepSeek POST
    // this replaced had no fallback, so a 402 on that account sent every intro to
    // SAFE_DEFAULT and zeroed the intent bucket on articles that read perfectly well.
    const gw = await llmGateway({
      provider: 'openrouter',
      temperature: INTRO_TEMPERATURE,
      seed: 7,
      responseFormat: 'json_object',
      maxTokens: 800,
      jobType: 'intro_judge',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    const parsed = safeJsonParse<Partial<IntroVerdict>>(gw.text ?? '', {});
    return {
      intentConfirmed: !!parsed.intentConfirmed,
      answerStartsEarly: !!parsed.answerStartsEarly,
      audienceMentioned: !!parsed.audienceMentioned,
      goalMentioned: !!parsed.goalMentioned,
      expectationsSet: !!parsed.expectationsSet,
      detectedMainQuestion: parsed.detectedMainQuestion,
    };
  },
};
