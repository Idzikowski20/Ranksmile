/**
 * Thin Serper.dev search — URLs + PAA only (Node fallback when deep-analysis payload empty).
 * Prefer sidecar scrape; this is for standalone enqueue with SERPER_API_KEY.
 */
export type SerperFetchResult = {
  urls: string[];
  paaQuestions: Array<{ question: string }>;
};

export async function fetchSerperUrls(opts: {
  keyword: string;
  language?: string;
  num?: number;
  apiKey?: string;
}): Promise<SerperFetchResult> {
  const apiKey = opts.apiKey || process.env.SERPER_API_KEY || '';
  if (!apiKey) return { urls: [], paaQuestions: [] };

  const keyword = opts.keyword.trim();
  const num = Math.min(20, Math.max(5, opts.num ?? 10));
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({
          q: keyword,
          gl: opts.language === 'en' ? 'us' : 'pl',
          hl: opts.language || 'pl',
          num,
        }),
      });
      if (!res.ok) throw new Error(`serper HTTP ${res.status}`);
      const data = (await res.json()) as {
        organic?: Array<{ link?: string }>;
        peopleAlsoAsk?: Array<{ question?: string }>;
      };
      const urls = (data.organic || [])
        .map((o) => (o.link || '').trim())
        .filter(Boolean)
        .slice(0, num);
      const paaQuestions = (data.peopleAlsoAsk || [])
        .map((p) => ({ question: (p.question || '').trim() }))
        .filter((p) => p.question.length >= 8)
        .slice(0, 12);
      return { urls, paaQuestions };
    } catch (err: unknown) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
  console.warn('[fetchSerperUrls] failed after retries:', lastErr);
  return { urls: [], paaQuestions: [] };
}
