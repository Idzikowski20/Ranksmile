import { isUsableArticleHtml } from './articleHtmlUsable';

/**
 * Resume rules for /articles/generating:
 * - running/queued → poll existing job
 * - done + usable article HTML → finish
 * - done + empty/stub content → start a fresh generate (stale empty "success")
 * - failed/missing → start fresh
 */
export function shouldSkipFreshGenerate(opts: {
  jobStatus?: string;
  articleHtml?: string | null;
}): 'poll' | 'finish' | 'fresh' {
  const status = opts.jobStatus || '';
  if (status === 'running' || status === 'queued') return 'poll';
  if (status === 'done') {
    return isUsableArticleHtml(opts.articleHtml || '') ? 'finish' : 'fresh';
  }
  return 'fresh';
}
