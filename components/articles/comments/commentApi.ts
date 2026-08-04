/** Comment API URL builder (authenticated owner session). */
export const commentsUrl = (articleId: string, params?: Record<string, string>): string => {
  const qs = new URLSearchParams(params).toString();
  return `/api/articles/${articleId}/comments${qs ? `?${qs}` : ''}`;
};
