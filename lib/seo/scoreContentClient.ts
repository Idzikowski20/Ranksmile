import type { ScoreData } from '../contentScore';

export type RankingSignal = { name: string; score: number; recommendation?: string };
export type RankingSignalsPayload = { signals?: RankingSignal[] };
export type ScoreContentResult = { ranking_score: number; ranking_signals: RankingSignalsPayload };

export async function scoreContent(
  html: string,
  keyword: string,
  scoreData: ScoreData | Record<string, unknown> | null,
  articleTitle: string,
  articleMetaDescription: string
): Promise<ScoreContentResult | null> {
  const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${sidecarUrl}/score-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '',
      },
      body: JSON.stringify({
        html,
        keyword,
        title: articleTitle,
        meta_description: articleMetaDescription,
        score_data: {
          terms: scoreData?.terms || [],
          words_target: scoreData?.words_target || 2200,
          headings_target: scoreData?.headings_target || 15,
          paragraphs_target: scoreData?.paragraphs_target || 20,
        },
      }),
      signal: controller.signal,
    });
    if (res.ok) return res.json();
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
