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
import { isReviewOutlineHtml } from '@/src/infrastructure/contentPlanner/reviewOutline';

export type OutlineReviewInput = {
  content?: string | null;
  /** Parsed or raw `score_data`; the planner bundle inside it is what is read. */
  scoreData?: Record<string, unknown> | string | null;
  /** `articles.status`; the planner writes 'review' when it stores an outline. */
  status?: string | null;
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
  // The step as the planner recorded it. Everything below infers review from the shape of
  // the row, which is what rows written before this status existed still need.
  if (article.status === 'review' && !stripHtmlToPlain(html).length) return true;
  // Emptiness, not usability. `isUsableArticleHtml` demands 80 plain characters, so a
  // short but deliberately authored draft on an article that also has planner metadata
  // was reopened in outline review and its autosave suspended. Anything the author has
  // actually written counts as written.
  if (stripHtmlToPlain(html).length > 0) return false;
  // A row that carries an explicit status is fully classified by the status branches
  // above — the only status that means "awaiting review" is 'review'. The planner bundle
  // lives in score_data for the article's whole life (planning writes it; it survives
  // generation), so it does NOT mean "never written". A finalized 'draft' whose content
  // is momentarily empty (a lost/failed persist) must not be pushed into review: that
  // suspends autosave, which keeps content empty — a deadlock that stranded article 162
  // as "review outline / Generate content" over a body that had already been generated.
  if (article.status) return false;
  // Legacy rows only — written before the 'review' status existed. A planner bundle then
  // is the only signal that an outline was produced and never turned into an article.
  return hasPlannerBundle(article.scoreData);
}
