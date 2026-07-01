import { CoverageItem, intentItems } from './aiCoverage';
import { safeJsonParse } from './safeJson';

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
  } catch {
    return SAFE_DEFAULT;
  }
}

/** Map the intro verdict onto the 5 fixed CoverageItem rows from intentItems(). */
export function introCoverageItems(verdict: IntroVerdict): CoverageItem[] {
  const map: Record<string, boolean> = {
    'intent-answer-main':  verdict.intentConfirmed,
    'intent-answer-early': verdict.answerStartsEarly,
    'intent-expectations': verdict.expectationsSet,
    'intent-who':          verdict.audienceMentioned,
    'intent-why':          verdict.goalMentioned,
  };
  return intentItems().map((it) => {
    const covered = !!map[it.id];
    return { ...it, covered, quality: covered ? 5 : 0 };
  });
}

const INTRO_MODEL = 'deepseek-chat';
const INTRO_TEMPERATURE = 0;
const INTRO_PROMPT_VERSION = 'v1';

export const deepseekIntroJudge: IntroductionJudge = {
  version: `${INTRO_PROMPT_VERSION}|${INTRO_MODEL}|${INTRO_TEMPERATURE}`,
  run: async (introText, targetKeyword) => {
    const system = 'You analyze the FIRST ~500 words of an SEO article. Reply ONLY with JSON.';
    const user =
      `Target keyword: "${targetKeyword}"\n\n` +
      'For the intro below, return JSON {' +
      '"intentConfirmed": bool, "answerStartsEarly": bool, ' +
      '"audienceMentioned": bool, "goalMentioned": bool, "expectationsSet": bool, ' +
      '"detectedMainQuestion": string}\n\n' +
      'Criteria:\n' +
      '- intentConfirmed: the intro names what this article delivers about the keyword\n' +
      '- answerStartsEarly: the first paragraph directly answers the main question (not background)\n' +
      '- audienceMentioned: the intro identifies who the reader is\n' +
      '- goalMentioned: the intro explains why this matters / what the reader gains\n' +
      '- expectationsSet: the intro previews the article structure or scope\n\n' +
      '=== INTRO ===\n' + introText + '\n=== END ===';
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: INTRO_MODEL, temperature: INTRO_TEMPERATURE, seed: 7,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`deepseek intro judge failed: ${res.status}`);
    const data = await res.json().catch(() => ({}));
    const parsed = safeJsonParse<Partial<IntroVerdict>>(data?.choices?.[0]?.message?.content ?? '', {});
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
