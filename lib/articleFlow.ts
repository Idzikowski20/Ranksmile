const WIZARD_STEPS = ['content-type', 'context', 'writing-mode'] as const;

export type ArticleEntryResolution =
  | { kind: 'editor' }
  | { kind: 'wizard'; step: string }
  | { kind: 'generating' };

export function resolveArticleEntry(article: {
  wizard_state?: string | null;
  content?: string | null;
  status?: string | null;
}, opts?: {
  /**
   * The wizard hands generation over to the editor with an EMPTY draft
   * (?reviewOutline=1) and only clears wizard_state once the article is written.
   * Without this the resume guard reads that hand-off as an unfinished wizard and
   * bounces the user straight back to the writing-mode step.
   */
  outlineReview?: boolean;
}): ArticleEntryResolution {
  if (article.status === 'generating') {
    return { kind: 'generating' };
  }
  const hasContent = !!(article.content || '').trim();
  if (!hasContent && article.wizard_state && !opts?.outlineReview) {
    try {
      const ws = JSON.parse(article.wizard_state) as { step?: string };
      const step = typeof ws.step === 'string' && WIZARD_STEPS.includes(ws.step as typeof WIZARD_STEPS[number])
        ? ws.step
        : 'content-type';
      return { kind: 'wizard', step };
    } catch {
      return { kind: 'wizard', step: 'content-type' };
    }
  }
  return { kind: 'editor' };
}

export function articleEntryHref(
  articleId: number | string,
  resolution: ArticleEntryResolution,
): string | null {
  const id = String(articleId);
  if (resolution.kind === 'generating') return `/articles/generating?articleId=${id}`;
  if (resolution.kind === 'wizard') return `/articles/${resolution.step}?articleId=${id}`;
  return null;
}

export function articleOutlineReviewHref(
  articleId: number | string,
  opts: { contentType: string; internalLinks: boolean; externalLinks: boolean },
): string {
  const query = new URLSearchParams({
    reviewOutline: '1',
    type: opts.contentType,
    internal: opts.internalLinks ? '1' : '0',
    external: opts.externalLinks ? '1' : '0',
  });
  return `/articles/${String(articleId)}?${query.toString()}`;
}
