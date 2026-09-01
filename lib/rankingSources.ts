import type { AiVisibilitySummary } from './aiSearchScore';
import type { SerpCompetitor } from './types/sidecar';

export type RankingGoogleSource = { rank: number; domain: string; url: string; title: string };
export type RankingAiSource = { domain: string; url: string; title: string };

export type RankingSourcesPayload = {
  google: RankingGoogleSource[];
  ai: RankingAiSource[];
};

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function buildGoogleRankingSources(competitors: SerpCompetitor[]): RankingGoogleSource[] {
  return (competitors || [])
    .filter((c) => c.url)
    .map((c, i) => ({
      rank: c.serp_position ?? i + 1,
      domain: (c.domain || hostFromUrl(c.url)).replace(/^www\./, ''),
      url: c.url,
      title: c.title || c.snippet || c.domain || c.url,
    }))
    .slice(0, 20);
}

export function buildGoogleRankingSourcesFromRows(
  rows: Array<{ url: string; domain: string; title: string; snippet?: string | null }>,
): RankingGoogleSource[] {
  return rows
    .filter((r) => r.url)
    .map((r, i) => ({
      rank: i + 1,
      domain: (r.domain || hostFromUrl(r.url)).replace(/^www\./, ''),
      url: r.url,
      title: r.title || r.snippet || r.domain || r.url,
    }))
    .slice(0, 20);
}

export function buildAiRankingSources(summary?: AiVisibilitySummary | null): RankingAiSource[] {
  const seen = new Set<string>();
  const out: RankingAiSource[] = [];

  for (const c of summary?.citations || []) {
    const url = (c.cited_url || '').trim();
    const domain = (c.cited_domain || (url ? hostFromUrl(url) : '')).replace(/^www\./, '');
    if (!url && !domain) continue;

    const key = url || domain;
    if (seen.has(key)) continue;
    seen.add(key);

    const title = (c.prompt || '').trim();
    out.push({
      domain,
      url: url || (domain ? `https://${domain}` : ''),
      title: title.length > 96 ? `${title.slice(0, 96)}…` : (title || domain),
    });
    if (out.length >= 30) break;
  }

  return out;
}

export function buildRankingSourcesPayload(opts: {
  competitors?: SerpCompetitor[];
  aiSummary?: AiVisibilitySummary | null;
}): RankingSourcesPayload {
  return {
    google: buildGoogleRankingSources(opts.competitors || []),
    ai: buildAiRankingSources(opts.aiSummary),
  };
}

export function parseRankingSources(raw: unknown): RankingSourcesPayload {
  if (!raw) return { google: [], ai: [] };
  try {
    const rs = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!rs || typeof rs !== 'object') return { google: [], ai: [] };
    const obj = rs as Record<string, unknown>;
    return {
      google: Array.isArray(obj.google) ? obj.google as RankingGoogleSource[] : [],
      ai: Array.isArray(obj.ai) ? obj.ai as RankingAiSource[] : [],
    };
  } catch {
    return { google: [], ai: [] };
  }
}
