import type { ScoreFactor } from './factors';
import { scoreIntroduction } from './introductionFactors';

type ScoreDataLike = {
  terms?: Array<{ term?: string }>;
  content_planner_v2?: { bundle?: { reader?: { readerPersona?: string } } } | null;
} | null | undefined;

const TOPIC_LIMIT = 8;
const MIN_AUDIENCE_WORD = 4;

/**
 * One place to derive the introduction scorer's inputs, so the number on the gauge and
 * the factor list beneath it are computed from identical evidence — whether it runs
 * server-side after generation or live in the editor while the user types.
 */
// eslint-disable-next-line import/prefer-default-export
export function introFactorsFromScoreData(opts: {
  html: string;
  keyword: string;
  scoreData: ScoreDataLike;
}): ScoreFactor[] {
  const coveredTopics = (opts.scoreData?.terms ?? [])
    .map((term) => (term?.term || '').trim())
    .filter(Boolean)
    .slice(0, TOPIC_LIMIT);

  const persona = opts.scoreData?.content_planner_v2?.bundle?.reader?.readerPersona || '';
  const audienceTerms = persona
    .split(/[\s,;/]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= MIN_AUDIENCE_WORD);

  return scoreIntroduction({
    html: opts.html,
    keyword: opts.keyword,
    coveredTopics,
    audienceTerms,
  });
}
