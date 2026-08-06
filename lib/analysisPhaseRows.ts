import type { AnalysisPhases, CrawlPhase, SimplePhase } from './analysisPhases';

export type RowState = 'done' | 'active' | 'pending' | 'error';
export type PhaseRow = { id: string; label: string; state: RowState; detail?: string };
export type PhaseGroup = { id: 'ai-search' | 'google'; title: string; rows: PhaseRow[] };

function stateOf(phase: SimplePhase): RowState {
  if (phase.status === 'ERROR') return 'error';
  if (phase.status === 'DONE') return 'done';
  if (phase.status === 'RUNNING') return 'active';
  return 'pending';
}

/** A row that only lights up once its phase has finished (the "…guidelines" tail rows). */
function trailingState(phase: SimplePhase): RowState {
  if (phase.status === 'ERROR') return 'error';
  return phase.status === 'DONE' ? 'done' : 'pending';
}

function hostOf(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function crawlLabel(crawl: CrawlPhase): string {
  if (crawl.status === 'DONE') return 'Crawled competitor pages';
  if (typeof crawl.finished === 'number' && typeof crawl.total === 'number') {
    return `Crawling result ${crawl.finished}/${crawl.total}`;
  }
  return 'Crawling…';
}

export function analysisPhaseGroups(phases: AnalysisPhases): PhaseGroup[] {
  const serpCount = phases.crawlingSerp.total;
  const crawlHost = hostOf(phases.crawlingSerp.currentUrl);
  return [
    {
      id: 'ai-search',
      title: 'AI Search',
      rows: [
        {
          id: 'prompts',
          label: 'Generated prompts',
          state: phases.aiSearch.status === 'NEW' ? 'pending' : 'done',
        },
        {
          id: 'answers',
          label: 'Scraping answers from ChatGPT, AI Overviews, Gemini, AI Mode, Perplexity',
          state: stateOf(phases.aiSearch),
          ...(phases.aiSearch.error ? { detail: phases.aiSearch.error } : {}),
        },
        {
          id: 'ai-guidelines',
          label: 'Calculating AI Search guidelines',
          state: trailingState(phases.aiSearch),
        },
      ],
    },
    {
      id: 'google',
      title: 'Google Search results',
      rows: [
        {
          id: 'serp',
          label: serpCount ? `Got ${serpCount} search results` : 'Getting search results',
          state: stateOf(phases.fetchingSerp),
          ...(phases.fetchingSerp.error ? { detail: phases.fetchingSerp.error } : {}),
        },
        {
          id: 'crawling',
          label: crawlLabel(phases.crawlingSerp),
          state: stateOf(phases.crawlingSerp),
          ...(crawlHost ? { detail: crawlHost } : {}),
        },
        {
          id: 'seo-guidelines',
          label: 'Calculating Content Scores and SEO guidelines',
          state: trailingState(phases.loadingCompetitors),
        },
      ],
    },
  ];
}
