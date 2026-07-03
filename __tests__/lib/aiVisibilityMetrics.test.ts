import { ownDomainPosition, computeOverview, aggregateSources, aggregateCompetitors, buildSnapshot, snapshotForDomain, buildSnapshotsForScan, rankCompetitors, COMPETITOR_NOISE, computeDelta, mentionGap, gapBrandCandidates, brandsForSource, ResultRow } from '../../lib/aiVisibilityMetrics';

const cit = (domain: string, url?: string) => ({ domain, url: url || `https://${domain}/x`, title: '' });
const brand = (b: string, domain = '', sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' = 'neutral', pos = 1) => ({ brand: b, domain, sentiment, pos, quotes: [] });

const brandRows: ResultRow[] = [
   { promptId: 1, model: 'gemini', ownCited: false, ownPosition: null, topic: 'T', text: 'Q',
     citations: [cit('oracle.com', 'https://oracle.com/a')], brands: [brand('Oracle', 'oracle.com'), brand('Idztech', 'idztech.pl', 'positive', 2)] },
   { promptId: 2, model: 'chat_gpt', ownCited: false, ownPosition: null, topic: 'T', text: 'Q',
     citations: [cit('oracle.com', 'https://oracle.com/a')], brands: [brand('Oracle', 'oracle.com')] },
];

const rows: ResultRow[] = [
   { promptId: 1, model: 'chat_gpt', ownCited: true, ownPosition: 1, topic: 'T', text: 'Q', brands: [], citations: [cit('idztech.pl', 'https://idztech.pl/a'), cit('oracle.com')] },
   { promptId: 1, model: 'gemini', ownCited: false, ownPosition: null, topic: 'T', text: 'Q', brands: [], citations: [cit('oracle.com')] },
   { promptId: 2, model: 'chat_gpt', ownCited: true, ownPosition: 3, topic: 'T', text: 'Q', brands: [], citations: [cit('shoper.pl'), cit('oracle.com'), cit('idztech.pl', 'https://idztech.pl/b')] },
   { promptId: 2, model: 'gemini', ownCited: false, ownPosition: null, topic: 'T', text: 'Q', brands: [], citations: [] },
];

describe('ownDomainPosition', () => {
   it('returns 1-based index of first own citation, www-insensitive', () => {
      expect(ownDomainPosition([cit('a.com'), cit('www.idztech.pl')], 'idztech.pl')).toBe(2);
      expect(ownDomainPosition([cit('a.com')], 'idztech.pl')).toBeNull();
      expect(ownDomainPosition([cit('a.com')], '')).toBeNull();
   });
});

describe('computeOverview', () => {
   it('computes score, rate, position, citations, pages', () => {
      const o = computeOverview(rows);
      // scores: 100 (p1) + 0 + 70 (p3) + 0 = 170/4 = 42.5 → 43
      expect(o.visibilityScore).toBe(43);
      expect(o.mentionRate).toBe(50);
      expect(o.avgPosition).toBe(2);
      expect(o.directCitations).toBe(2);
      expect(o.pages).toBe(2);
      const byModel = Object.fromEntries(o.perModel.map((m) => [m.model, m.score]));
      expect(byModel).toEqual({ chat_gpt: 85, gemini: 0 });
   });
   it('handles empty input', () => {
      const o = computeOverview([]);
      expect(o.visibilityScore).toBe(0);
      expect(o.avgPosition).toBeNull();
      expect(o.mentionRate).toBe(0);
   });
});

describe('aggregateSources', () => {
   it('counts url occurrences across models, sorted desc', () => {
      const s = aggregateSources(rows);
      const oracle = s.find((x) => x.domain === 'oracle.com');
      expect(oracle?.timesShown).toBe(3);
      expect(oracle?.models.sort()).toEqual(['chat_gpt', 'gemini']);
      expect(s[0].timesShown).toBeGreaterThanOrEqual(s[s.length - 1].timesShown);
   });
});

describe('aggregateCompetitors', () => {
   it('excludes own domain and computes share of total citations', () => {
      const c = aggregateCompetitors(rows, 'idztech.pl');
      expect(c.find((x) => x.domain === 'idztech.pl')).toBeUndefined();
      expect(c[0].domain).toBe('oracle.com');
      expect(c[0].mentions).toBe(3);
   });
});

describe('buildSnapshot', () => {
   it('bundles overview, sources, and the set of prompts where own was cited', () => {
      const snap = buildSnapshot(rows, 'idztech.pl');
      expect(snap.overview.visibilityScore).toBe(43);
      expect(snap.sources.find((s) => s.domain === 'oracle.com')?.timesShown).toBe(3);
      // prompt 1 (chat_gpt cited) and prompt 2 (chat_gpt cited) → both cited; unique + sorted
      expect(snap.citedPromptIds).toEqual([1, 2]);
   });
   it('empty rows → empty citedPromptIds', () => {
      expect(buildSnapshot([], 'idztech.pl').citedPromptIds).toEqual([]);
   });
});

describe('snapshotForDomain', () => {
   it('equals buildSnapshot when domain === own', () => {
      const snap = snapshotForDomain(rows, 'idztech.pl');
      expect(snap.overview.visibilityScore).toBe(43);
      expect(snap.citedPromptIds).toEqual([1, 2]);
      expect(snap.prompts.find((p) => p.promptId === 1)?.score).toBe(50);
   });
   it('re-projects onto an arbitrary domain (oracle.com)', () => {
      const snap = snapshotForDomain(rows, 'oracle.com');
      expect(snap.overview.visibilityScore).toBeGreaterThan(0);
      expect(snap.overview.mentionRate).toBeGreaterThan(0);
   });
   it('aggregates prompts into topics', () => {
      expect(snapshotForDomain(rows, 'idztech.pl').topics.find((x) => x.topic === 'T')).toBeDefined();
   });
   it('uncited domain → all zero', () => {
      const snap = snapshotForDomain(rows, 'nobody.example');
      expect(snap.overview.visibilityScore).toBe(0);
      expect(snap.citedPromptIds).toEqual([]);
   });
});

describe('competitor ranking', () => {
   const rowsWithNoise: ResultRow[] = [
      { promptId: 1, model: 'gemini', ownCited: false, ownPosition: null, topic: 'T', text: 'Q', brands: [], citations: [cit('vertexaisearch.cloud.google.com'), cit('oracle.com', 'https://oracle.com/a')] },
      { promptId: 2, model: 'chat_gpt', ownCited: false, ownPosition: null, topic: 'T', text: 'Q', brands: [], citations: [cit('oracle.com', 'https://oracle.com/b')] },
   ];
   it('COMPETITOR_NOISE lists the grounding proxy', () => {
      expect(COMPETITOR_NOISE).toContain('vertexaisearch.cloud.google.com');
   });
   it('buildSnapshotsForScan: entry per own + cited domain, minus noise', () => {
      const map = buildSnapshotsForScan(rowsWithNoise, 'idztech.pl');
      expect(map.has('idztech.pl')).toBe(true);
      expect(map.has('oracle.com')).toBe(true);
      expect(map.has('vertexaisearch.cloud.google.com')).toBe(false);
   });
   it('rankCompetitors: full snapshots, sorted desc, own excluded', () => {
      const ranked = rankCompetitors(buildSnapshotsForScan(rowsWithNoise, 'idztech.pl'), 'idztech.pl');
      expect(ranked.find((c) => c.domain === 'idztech.pl')).toBeUndefined();
      expect(ranked[0].domain).toBe('oracle.com');
      expect(ranked[0].snapshot.overview.visibilityScore).toBeGreaterThan(0);
      expect(ranked[0].snapshot.prompts.length).toBeGreaterThan(0); // full snapshot embedded
   });
});

describe('aggregateSources with brands', () => {
   it('marks mentioned when own brand appears in a citing answer, and lists brands', () => {
      const s = aggregateSources(brandRows, 'Idztech').find((x) => x.url === 'https://oracle.com/a');
      expect(s?.mentioned).toBe(true);
      expect(s?.brands.map((b) => b.brand)).toContain('Oracle');
   });
   it('own brand is not listed as a competitor chip', () => {
      const s = aggregateSources(brandRows, 'Idztech').find((x) => x.url === 'https://oracle.com/a');
      expect(s?.brands.map((b) => b.brand)).not.toContain('Idztech');
   });
});
describe('mentionGap', () => {
   it('counts gap (competitor without you), shared, and you-only over answers', () => {
      expect(mentionGap(brandRows, 'Oracle', 'Idztech')).toEqual({ brand: 'Oracle', gap: 1, shared: 1, you: 0 });
   });
});
describe('gapBrandCandidates', () => {
   it('lists competitor brands by frequency, excluding own', () => {
      expect(gapBrandCandidates(brandRows, 'Idztech')).toEqual(['Oracle']);
   });
});
describe('brandsForSource', () => {
   it('returns per-url brands ordered by pos with dominant sentiment', () => {
      const b = brandsForSource(brandRows, 'https://oracle.com/a');
      expect(b[0].brand).toBe('Oracle');
      expect(b.find((x) => x.brand === 'Idztech')?.sentiment).toBe('positive');
   });
});

describe('computeDelta', () => {
   const previous = buildSnapshot([
      { promptId: 1, model: 'chat_gpt', ownCited: true, ownPosition: 3, topic: 'T', text: 'Q', brands: [], citations: [cit('oracle.com'), cit('shoper.pl'), cit('idztech.pl', 'https://idztech.pl/a')] },
      { promptId: 2, model: 'chat_gpt', ownCited: false, ownPosition: null, topic: 'T', text: 'Q', brands: [], citations: [cit('oracle.com')] },
   ], 'idztech.pl');
   const current = buildSnapshot([
      { promptId: 1, model: 'chat_gpt', ownCited: true, ownPosition: 1, topic: 'T', text: 'Q', brands: [], citations: [cit('idztech.pl', 'https://idztech.pl/a'), cit('vercel.com')] },
      { promptId: 2, model: 'chat_gpt', ownCited: false, ownPosition: null, topic: 'T', text: 'Q', brands: [], citations: [cit('oracle.com')] },
   ], 'idztech.pl');

   it('reports score delta with direction', () => {
      const d = computeDelta(current, previous);
      // current p1 score 100, p2 0 → 50; previous p1 70, p2 0 → 35
      expect(d.visibilityScore).toEqual({ current: 50, previous: 35, delta: 15, trend: 'up' });
   });
   it('reports sources added and removed (by domain, deduped)', () => {
      const d = computeDelta(current, previous);
      expect(d.sources.added.sort()).toEqual(['vercel.com']);
      expect(d.sources.removed.sort()).toEqual(['shoper.pl']);
   });
   it('reports prompts that gained/lost own citation', () => {
      const gainedCase = computeDelta(
         buildSnapshot([{ promptId: 9, model: 'gemini', ownCited: true, ownPosition: 1, topic: 'T', text: 'Q', brands: [], citations: [cit('idztech.pl')] }], 'idztech.pl'),
         buildSnapshot([{ promptId: 9, model: 'gemini', ownCited: false, ownPosition: null, topic: 'T', text: 'Q', brands: [], citations: [] }], 'idztech.pl'),
      );
      expect(gainedCase.prompts.gained).toEqual([9]);
      expect(gainedCase.prompts.lost).toEqual([]);
   });
   it('down and same trends', () => {
      const same = computeDelta(previous, previous);
      expect(same.visibilityScore.trend).toBe('same');
      const down = computeDelta(previous, current);
      expect(down.visibilityScore.trend).toBe('down');
   });
});
