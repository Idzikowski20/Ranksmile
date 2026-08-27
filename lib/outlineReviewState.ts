/**
 * "This article is an outline awaiting review, not a written article."
 *
 * The state used to live only in `?reviewOutline=1`, which a fresh navigation drops, and
 * three separate places re-derived it from that param alone: the editor's review mode,
 * the page's right-hand panel, and the wizard-resume guard. Leaving and returning
 * therefore showed the outline as a finished article and graded it as one.
 *
 * One implementation so those three cannot disagree.
 */
import { stripHtmlToPlain } from '@/src/core/domain/articles/htmlUsable';
import { isReviewOutlineHtml } from './contentPlanner/reviewOutline';

export type OutlineReviewInput = {
  content?: string | null;
  /** Parsed or raw `score_data`; the planner bundle inside it is what is read. */
  scoreData?: Record<string, unknown> | string | null;
};

function hasPlannerBundle(scoreData: OutlineReviewInput['scoreData']): boolean {
  if (!scoreData) return false;
  if (typeof scoreData === 'string') {
    // Cheaper and safer than parsing a large blob just to test for one key.
    return scoreData.includes('"content_planner_v2"');
  }
  return Boolean(scoreData.content_planner_v2);
}

export function isOutlineAwaitingReview(article: OutlineReviewInput | null | undefined): boolean {
  if (!article) return false;
  const html = article.content || '';
  // Length cannot separate the two: an outline carries five or six instruction sentences
  // per heading and clears the usable-article bar comfortably. Recognise the document
  // itself first — that also rescues articles whose outline was persisted into content
  // by an earlier build, before autosave was suspended during review.
  if (isReviewOutlineHtml(html)) return true;
  // Emptiness, not usability. `isUsableArticleHtml` demands 80 plain characters, so a
  // short but deliberately authored draft on an article that also has planner metadata
  // was reopened in outline review and its autosave suspended. Anything the author has
  // actually written counts as written.
  if (stripHtmlToPlain(html).length > 0) return false;
  // Nothing written yet. A planner bundle means an outline was produced for this article
  // and never turned into an article; without one there is simply nothing to review.
  return hasPlannerBundle(article.scoreData);
}
