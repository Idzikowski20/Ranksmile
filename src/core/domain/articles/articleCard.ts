/**
 * What an article card shows: one badge and one thumbnail.
 *
 * The badge answers "what happens when I click this": a planned outline waits for
 * Generate content, a written draft opens in the editor, a published article is live.
 * The thumbnail is the article's own HTML, cut to its first blocks and scaled down.
 */

export type ArticleCardStatus = 'waiting_review' | 'being_edited' | 'published' | 'generating';

const PIPELINE_STATUSES = new Set(['generating', 'analyzing', 'queued', 'running', 'finalizing']);

export function articleCardStatus(article: {
  status: string | null | undefined;
  publish_url: string | null | undefined;
  /** The body is the review outline (planned headings), not a written article. */
  is_outline: boolean;
  has_content: boolean;
}): ArticleCardStatus {
  const status = (article.status || '').toLowerCase();
  if (status === 'published' || !!article.publish_url) return 'published';
  if (PIPELINE_STATUSES.has(status)) return 'generating';
  if (article.is_outline || !article.has_content) return 'waiting_review';
  return 'being_edited';
}

export const ARTICLE_CARD_STATUS_LABEL: Record<ArticleCardStatus, string> = {
  waiting_review: 'Waiting review',
  being_edited: 'Being edited',
  published: 'Published',
  generating: 'Generating',
};

const BLOCK_END = /<\/(p|h[1-6]|ul|ol|blockquote|table|figure|pre|div)>/gi;

/** A URL scheme that must never reach the thumbnail's href/src (js:, data:text/html, vbscript:). */
const DANGEROUS_URL = /^\s*(javascript|vbscript|data|file):/i;

/** Anything that would run or load inside the thumbnail. */
function inert(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Neutralise dangerous href/src schemes — the preview sets innerHTML, so a
    // javascript:/data:text/html link would otherwise be clickable/loadable.
    .replace(/\s(href|src|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (m, attr, raw) => {
      const val = raw.replace(/^["']|["']$/g, '');
      return DANGEROUS_URL.test(val.replace(/&#(\d+);?/g, (_: string, d: string) => String.fromCharCode(Number(d))))
        ? ` ${attr}="#"`
        : m;
    });
}

/**
 * The first blocks of the article, within `maxChars`, cut only at a block boundary so
 * the thumbnail never renders a torn tag. A single oversized first block is kept whole.
 */
export function articlePreviewHtml(content: string | null | undefined, maxChars: number): string {
  const html = inert((content || '').trim());
  if (!html) return '';
  if (html.length <= maxChars) return html;
  let cut = -1;
  for (const m of html.matchAll(BLOCK_END)) {
    const end = m.index + m[0].length;
    if (end > maxChars) break;
    cut = end;
  }
  if (cut > 0) return html.slice(0, cut);
  const first = BLOCK_END.exec(html);
  BLOCK_END.lastIndex = 0;
  return first ? html.slice(0, first.index + first[0].length) : html;
}
