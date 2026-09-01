/**
 * Legacy site segment → canonical segment.
 * Keep in sync with next.config.js `redirects()` (same pairs).
 */
export const SITE_SEGMENT_REDIRECTS: ReadonlyArray<readonly [from: string, to: string]> = [
  ['rank-tracking', 'keyword-tracking'],
  ['search-intelligence', 'keyword-list'],
  ['keyword-tracker', 'keyword-tracking'],
  ['console', 'performance'],
  ['insight', 'performance'],
  ['ideas', 'recommendations'],
  ['audit', 'content-audit'],
];

export function buildSiteSegmentRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return SITE_SEGMENT_REDIRECTS.flatMap(([from, to]) => [
    {
      source: `/sites/:domain/${from}`,
      destination: `/sites/:domain/${to}`,
      permanent: true,
    },
    {
      source: `/workspace/:wsId/sites/:domain/${from}`,
      destination: `/workspace/:wsId/sites/:domain/${to}`,
      permanent: true,
    },
  ]);
}
