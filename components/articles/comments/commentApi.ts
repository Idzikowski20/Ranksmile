// Comment API URL builder. Anonymous reviewers reach the comment endpoints by their
// article's opaque share token (the page has no session); authenticated owners omit
// it and are gated by their session instead. Centralized so the `?`/`&` query joining
// stays correct across every caller.
export const commentsUrl = (articleId: string, shareToken?: string, params?: Record<string, string>): string => {
  const sp = new URLSearchParams(params);
  if (shareToken) sp.set('token', shareToken);
  const qs = sp.toString();
  return `/api/articles/${articleId}/comments${qs ? `?${qs}` : ''}`;
};
