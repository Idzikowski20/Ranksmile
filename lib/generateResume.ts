import { isUsableArticleHtml } from './articleHtmlUsable';

/**
 * Resume rules for /articles/generating:
 * - running/queued → poll existing job
 * - done + usable article HTML → finish
 * - done + empty/stub content → return to mandatory outline review
 * - failed/missing → return to mandatory outline review
 */
export function shouldSkipFreshGenerate(opts: {
  jobStatus?: string;
  articleHtml?: string | null;
}): 'poll' | 'finish' | 'review' {
  const status = opts.jobStatus || '';
  if (status === 'running' || status === 'queued') return 'poll';
  if (status === 'done') {
    return isUsableArticleHtml(opts.articleHtml || '') ? 'finish' : 'review';
  }
  return 'review';
}
