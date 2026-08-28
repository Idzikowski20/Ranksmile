const SITE_SEGMENT_REDIRECTS = [
  ['rank-tracking', 'keyword-tracking'],
  ['search-intelligence', 'keyword-list'],
  ['keyword-tracker', 'keyword-tracking'],
  ['console', 'performance'],
  ['insight', 'performance'],
  ['ideas', 'recommendations'],
  ['audit', 'content-audit'],
];

function buildSiteSegmentRedirects() {
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

module.exports = {
  SITE_SEGMENT_REDIRECTS,
  buildSiteSegmentRedirects,
};
