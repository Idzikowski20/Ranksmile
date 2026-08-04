export type CiaZoneId = 'ccm' | 'compiler' | 'projections' | 'planner' | 'intelligence';

export type CiaZone = {
  readonly id: CiaZoneId;
  /** Repo-relative path prefix using forward slashes, e.g. lib/projections/ */
  readonly root: string;
  readonly forbiddenSubstrings: readonly string[];
};

export const CIA_ZONES: readonly CiaZone[] = [
  {
    id: 'ccm',
    root: 'lib/ccm/',
    forbiddenSubstrings: ['cheerio', 'jsdom', 'engines/coverageEngine', 'coverageSnapshotToKg'],
  },
  {
    id: 'compiler',
    root: 'lib/compiler/',
    forbiddenSubstrings: [
      'cheerio',
      'jsdom',
      '/lib/ao/',
      'lib/ao/',
      '../ao/',
      '/lib/wie/',
      'lib/wie/',
      '../wie/',
      'engines/coverageEngine',
    ],
  },
  {
    id: 'projections',
    root: 'lib/projections/',
    forbiddenSubstrings: [
      'cheerio',
      'jsdom',
      'engines/coverageEngine',
      'coverageSnapshotToKg',
      'coverageSnapshotToCcm',
      'buildCoverageSnapshot',
      'aiCoverageJudge',
    ],
  },
  {
    id: 'planner',
    root: 'lib/planner/',
    forbiddenSubstrings: [
      'cheerio',
      'jsdom',
      'coverageSnapshotToKg',
      'coverageSnapshotToCcm',
      'engines/coverageEngine',
      'aiCoverageJudge',
    ],
  },
  {
    id: 'intelligence',
    root: 'lib/intelligence/',
    forbiddenSubstrings: [
      'cheerio',
      'jsdom',
      'coverageSnapshotToKg',
      'coverageSnapshotToCcm',
      'engines/coverageEngine',
      'aiCoverageJudge',
    ],
  },
] as const;

function normalizeSpec(spec: string): string {
  return spec.replace(/\\/g, '/');
}

/** True if this import specifier is banned for the zone. */
export function isForbiddenImport(zoneId: CiaZoneId, specifier: string): boolean {
  const zone = CIA_ZONES.find((z) => z.id === zoneId);
  if (!zone) return false;
  const s = normalizeSpec(specifier);
  return zone.forbiddenSubstrings.some((frag) => s.includes(frag));
}
