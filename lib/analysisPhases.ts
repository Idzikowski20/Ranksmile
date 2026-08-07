/**
 * Typed analysis phases. The sidecar reports one patch per event and Node merges
 * them, so the editor renders fields instead of parsing a progress sentence.
 * Shape mirrors the audited Surfer contract (fetchingSerp / crawlingSerp
 * { finished total } / loadingCompetitors) plus our own aiSearch phase.
 */
export type PhaseStatus = 'NEW' | 'RUNNING' | 'DONE' | 'ERROR';

export type SimplePhase = { status: PhaseStatus; error?: string | null };

export type CrawlPhase = SimplePhase & {
  finished: number | null;
  total: number | null;
  currentUrl?: string | null;
};

export type AnalysisPhases = {
  importingContent: SimplePhase;
  fetchingSerp: SimplePhase;
  crawlingSerp: CrawlPhase;
  loadingCompetitors: SimplePhase;
  aiSearch: SimplePhase;
};

/**
 * An event patches fields inside a phase ("the crawl reached 6/10"), so both the phase
 * set and each phase's own fields are optional — `Partial<AnalysisPhases>` would still
 * demand a whole CrawlPhase.
 */
export type AnalysisPhasesPatch = {
  [K in keyof AnalysisPhases]?: Partial<AnalysisPhases[K]>;
};

export function emptyPhases(): AnalysisPhases {
  const simple = (): SimplePhase => ({ status: 'NEW', error: null });
  return {
    importingContent: simple(),
    fetchingSerp: simple(),
    crawlingSerp: {
      status: 'NEW', finished: null, total: null, currentUrl: null, error: null,
    },
    loadingCompetitors: simple(),
    aiSearch: simple(),
  };
}

/**
 * A finished phase stays finished. Stage events keep arriving after a phase reports
 * DONE (the runner reports every stage), and the coarse stage fallback would otherwise
 * push a completed crawl back to RUNNING and reopen the spinner.
 */
function mergePhase<T extends SimplePhase>(base: T, patch?: Partial<T>): T {
  if (!patch) return base;
  const reopensDone = base.status === 'DONE' && patch.status === 'RUNNING';
  return { ...base, ...patch, ...(reopensDone ? { status: base.status } : {}) };
}

export function mergePhases(
  prev: AnalysisPhases | null,
  patch: AnalysisPhasesPatch,
): AnalysisPhases {
  const base = prev ?? emptyPhases();
  return {
    importingContent: mergePhase(base.importingContent, patch.importingContent),
    fetchingSerp: mergePhase(base.fetchingSerp, patch.fetchingSerp),
    crawlingSerp: mergePhase(base.crawlingSerp, patch.crawlingSerp),
    loadingCompetitors: mergePhase(base.loadingCompetitors, patch.loadingCompetitors),
    aiSearch: mergePhase(base.aiSearch, patch.aiSearch),
  };
}

/** Fallback for stages that only report start/done (no per-item events yet). */
export function phasesFromStage(stage: string, stagePercent: number): AnalysisPhasesPatch {
  const done = stagePercent >= 100;
  switch (stage) {
    case 'fetch_page':
      return { importingContent: { status: done ? 'DONE' : 'RUNNING' } };
    case 'scrape_serp':
      return done
        ? { fetchingSerp: { status: 'DONE' }, crawlingSerp: { status: 'RUNNING' } }
        : { fetchingSerp: { status: 'RUNNING' } };
    case 'classify_content':
    case 'extract_terms':
      // These read the already-crawled pages; only competitor loading is in flight.
      return { loadingCompetitors: { status: done ? 'DONE' : 'RUNNING' } };
    case 'ai_search':
      return { aiSearch: { status: done ? 'DONE' : 'RUNNING' } };
    default:
      return {};
  }
}
