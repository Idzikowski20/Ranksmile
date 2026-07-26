export type PreviousCrawlMetrics = {
  siteHealth: number;
  pagesCrawled: number;
  totalErrors: number;
  totalWarnings: number;
};

export type CrawlVsPreviousDeltas = {
  siteHealthDelta: number | null;
  pagesDelta: number | null;
  errorsDelta: number | null;
  warningsDelta: number | null;
};

/** Live overview vs previous crawl snapshot. Null when no previous. */
export function crawlVsPreviousDeltas(
  live: {
    siteHealth: number;
    pagesCrawled: number;
    errors: number;
    warnings: number;
  },
  previous: PreviousCrawlMetrics | null,
): CrawlVsPreviousDeltas {
  if (!previous) {
    return {
      siteHealthDelta: null,
      pagesDelta: null,
      errorsDelta: null,
      warningsDelta: null,
    };
  }
  return {
    siteHealthDelta: live.siteHealth - previous.siteHealth,
    pagesDelta: live.pagesCrawled - previous.pagesCrawled,
    errorsDelta: live.errors - previous.totalErrors,
    warningsDelta: live.warnings - previous.totalWarnings,
  };
}
