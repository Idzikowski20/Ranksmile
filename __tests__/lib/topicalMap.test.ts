import { buildTopicClusters, hashStr, slugify } from '../../lib/topicalMap';

const TOPICS = [
  { id: 1, title: 'Programowanie Webowe', summary: null },
  { id: 2, title: 'Aplikacje Mobilne', summary: null },
];

describe('topicalMap adapter', () => {
  it('is deterministic across calls', () => {
    expect(JSON.stringify(buildTopicClusters(TOPICS)))
      .toEqual(JSON.stringify(buildTopicClusters(TOPICS)));
  });

  it('derives main keyword and 3-5 keywords total', () => {
    const [c] = buildTopicClusters(TOPICS);
    expect(c.mainKeyword).toBe('programowanie webowe');
    expect(c.keywords[0].isMain).toBe(true);
    expect(c.keywords.length).toBeGreaterThanOrEqual(3);
    expect(c.keywords.length).toBeLessThanOrEqual(5);
  });

  it('keeps metrics in range', () => {
    for (const c of buildTopicClusters(TOPICS)) {
      expect(c.kd).toBeGreaterThanOrEqual(0);
      expect(c.kd).toBeLessThanOrEqual(100);
      expect(c.vol).toBeGreaterThan(0);
      expect(c.vol % 10).toBe(0);
      expect(Math.abs(c.map.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(c.map.y)).toBeLessThanOrEqual(1);
      expect(c.dims).toHaveLength(7);
      c.dims.forEach((d) => { expect(d.value).toBeGreaterThan(0); expect(d.value).toBeLessThan(100); });
      expect(c.aiGap).toHaveLength(8);
      c.aiGap.forEach((g) => expect(g.have).toBeLessThanOrEqual(g.total));
      expect(c.competitors).toHaveLength(20);
      expect(new Set(c.competitors.map((x) => x.domain)).size).toBe(20);
    }
  });

  it('groups covered keywords under a slug url and the rest under Not Covered', () => {
    for (const c of buildTopicClusters(TOPICS)) {
      const covered = c.keywords.filter((k) => k.covered);
      const urlGroup = c.groups.find((g) => g.url !== null);
      if (covered.length) {
        expect(urlGroup).toBeDefined();
        expect(urlGroup!.url).toBe(`/${slugify(c.name)}`);
      }
      if (c.keywords.some((k) => !k.covered)) {
        expect(c.groups.find((g) => g.url === null)!.label).toBe('Not Covered');
      }
    }
  });

  it('opportunity tier matches score', () => {
    for (const c of buildTopicClusters(TOPICS)) {
      const s = c.opportunity.score;
      const tier = s >= 80 ? 'Very High' : s >= 60 ? 'High' : s >= 40 ? 'Medium' : 'Low';
      expect(c.opportunity.tier).toBe(tier);
    }
  });

  it('hash/slug helpers are stable', () => {
    expect(hashStr('abc')).toBe(hashStr('abc'));
    expect(slugify('Tworzenie Aplikacji Webowych — kurs')).toBe('tworzenie-aplikacji-webowych-kurs');
  });
});
