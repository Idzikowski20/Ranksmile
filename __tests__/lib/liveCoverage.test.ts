// __tests__/lib/liveCoverage.test.ts
import {
  liveCoverageItems, scoreAttribution, remainingOpportunities, scoreDeltaGate,
} from '../../lib/liveCoverage';
import { computeCoverageScores, type CoverageItem, type BucketScore } from '../../lib/aiCoverage';

// Item factory — mirrors __tests__/lib/aiCoverage.test.ts `gi` helper.
const item = (
  overrides: Partial<CoverageItem> & Pick<CoverageItem, 'id' | 'type'>,
): CoverageItem => ({
  label: overrides.id,
  category: 'knowledge',
  importance: 'recommended',
  source: 'manual',
  covered: false,
  quality: 0,
  ...overrides,
});

describe('liveCoverageItems', () => {
  it('immutability: input array + items unchanged; output is a new array', () => {
    const snap: readonly CoverageItem[] = [
      item({ id: 'e1', type: 'entity', label: 'widget', covered: false }),
      item({ id: 'f1', type: 'fact', label: 'widget', covered: false }),
    ];
    const snapCopy = snap.map((i) => ({ ...i }));
    const out = liveCoverageItems(snap, 'the widget is great', '<p>the widget is great</p>');

    expect(snap).toEqual(snapCopy); // input items unchanged (deep-equal original)
    expect(out).not.toBe(snap);     // new array
  });

  it('frozen-type items are the SAME object reference (verbatim); flipped presence item is a NEW object', () => {
    const frozen = item({ id: 'f1', type: 'fact', label: 'widget', covered: false });
    const entity = item({ id: 'e1', type: 'entity', label: 'widget', covered: false });
    const snap = [frozen, entity];
    const out = liveCoverageItems(snap, 'the widget is great', '<p>the widget is great</p>');

    expect(out[0]).toBe(frozen);        // verbatim same reference
    expect(out[1]).not.toBe(entity);    // new object (covered flipped)
    expect(out[1].covered).toBe(true);
  });

  it('entity flips covered false→true when label appears in plainText', () => {
    const snap = [item({ id: 'e1', type: 'entity', label: 'gizmo', covered: false })];
    const out = liveCoverageItems(snap, 'this article is about a gizmo', '<p>x</p>');
    expect(out[0].covered).toBe(true);
  });

  it('entity flips covered true→false when label is removed from plainText', () => {
    const snap = [item({ id: 'e1', type: 'entity', label: 'gizmo', covered: true })];
    const out = liveCoverageItems(snap, 'no mention of that term here', '<p>x</p>');
    expect(out[0].covered).toBe(false);
  });

  it('judge-only types (fact, definition, ...) are NEVER changed by presence check', () => {
    const frozenTypes: CoverageItem['type'][] = ['fact', 'definition', 'comparison', 'example', 'process', 'statistic', 'expectation', 'warning'];
    for (const type of frozenTypes) {
      const snap = [item({ id: `${type}-1`, type, label: 'gizmo', covered: false })];
      const out = liveCoverageItems(snap, 'this text clearly mentions gizmo many times', '<p>gizmo</p>');
      expect(out[0].covered).toBe(false);
      expect(out[0]).toBe(snap[0]);
    }
  });

  it('intent flips covered when FAQ H3 + answer matches the question', () => {
    const snap = [item({ id: 'i1', type: 'intent', label: 'Co to jest gizmo', covered: false })];
    const html = '<h3>Co to jest gizmo?</h3><p>Gizmo to urządzenie używane w testach pokrycia treści.</p>';
    const out = liveCoverageItems(snap, 'text', html);
    expect(out[0].covered).toBe(true);
  });

  describe('structure toggling', () => {
    it('covered true when html has headings/lists', () => {
      const snap = [item({ id: 's1', type: 'structure', label: 'Use structure', covered: false })];
      const html = '<h2>Section</h2><p>text</p><ul><li>a</li><li>b</li><li>c</li></ul>';
      const out = liveCoverageItems(snap, 'text', html);
      expect(out[0].covered).toBe(true);
    });

    it('covered false when html has no headings/lists', () => {
      const snap = [item({ id: 's1', type: 'structure', label: 'Use structure', covered: true })];
      const html = '<p>just a plain paragraph with no structure at all</p>';
      const out = liveCoverageItems(snap, 'text', html);
      expect(out[0].covered).toBe(false);
    });
  });

  describe('readability toggling', () => {
    it('covered true when paragraphs average ~120-450 chars', () => {
      const snap = [item({ id: 'r1', type: 'readability', label: 'Readable', covered: false })];
      const para = 'x'.repeat(200);
      const html = `<p>${para}</p><p>${para}</p>`;
      const out = liveCoverageItems(snap, 'text', html);
      expect(out[0].covered).toBe(true);
    });

    it('covered false when paragraphs are too short', () => {
      const snap = [item({ id: 'r1', type: 'readability', label: 'Readable', covered: true })];
      const html = '<p>short</p><p>also short</p>';
      const out = liveCoverageItems(snap, 'text', html);
      expect(out[0].covered).toBe(false);
    });
  });

  describe('paa toggling', () => {
    it('covered true when FAQ has H3 question + answer paragraph', () => {
      const snap = [item({ id: 'p1', type: 'paa', label: 'Kiedy można oskarżyć o nękanie', covered: false })];
      const html = '<h2>FAQ</h2><h3>Kiedy można oskarżyć o nękanie?</h3><p>Można zgłosić, gdy zachowania są uporczywe i budzą uzasadnioną obawę o zdrowie lub życie.</p>';
      const out = liveCoverageItems(snap, 'text', html);
      expect(out[0].covered).toBe(true);
    });

    it('question type (PAA from coverageEngine) presence-checks like paa + floors quality', () => {
      // Reproduces: AI checklist shows Covered while AI Search score stays 0 —
      // coverageEngine emits type=question, but live presence only handled type=paa.
      const snap = [item({
        id: 'q1',
        type: 'question',
        label: 'Czy inwigilacja jest legalna?',
        covered: false,
        quality: 0,
      })];
      const html = '<h3>Czy inwigilacja jest legalna?</h3><p>Inwigilacja może być legalna tylko gdy spełnia ustawowe warunki i ma podstawę prawną.</p>';
      const out = liveCoverageItems(snap, 'text', html);
      expect(out[0].covered).toBe(true);
      expect(out[0].quality).toBeGreaterThan(0);
      const { overall } = computeCoverageScores(out, false);
      expect(overall).toBeGreaterThan(0);
    });

    it('covered true when body text answers the question (>=70% content words present)', () => {
      const snap = [item({ id: 'p1', type: 'paa', label: 'What is the best gizmo cleaning method?', covered: false })];
      const html = '<p>The best gizmo cleaning method involves warm water and a soft cloth.</p>';
      const out = liveCoverageItems(snap, 'text', html);
      expect(out[0].covered).toBe(true);
    });

    it('covered false when the question is not answered anywhere', () => {
      const snap = [item({ id: 'p1', type: 'paa', label: 'What is the best gizmo cleaning method?', covered: true })];
      const html = '<p>This article is about something completely unrelated.</p>';
      const out = liveCoverageItems(snap, 'text', html);
      expect(out[0].covered).toBe(false);
    });
  });

  it('end-to-end: computeCoverageScores rises when an entity is added', () => {
    const snap = [
      item({ id: 'e1', type: 'entity', label: 'gizmo', covered: false, quality: 4 }),
      item({ id: 'e2', type: 'entity', label: 'widget', covered: false, quality: 4 }),
    ];
    const before = computeCoverageScores(liveCoverageItems(snap, 'nothing relevant here', '<p>x</p>'), false);
    const after = computeCoverageScores(liveCoverageItems(snap, 'this mentions gizmo now', '<p>x</p>'), false);
    expect(after.overall).toBeGreaterThan(before.overall);
  });

  it('end-to-end: computeCoverageScores is FLAT when only a frozen-only edit happens', () => {
    const snap = [
      item({ id: 'f1', type: 'fact', label: 'some fact', covered: true, quality: 4 }),
    ];
    const before = computeCoverageScores(liveCoverageItems(snap, 'original text', '<p>original</p>'), false);
    // Edit text/html but frozen item's coverage cannot move.
    const after = computeCoverageScores(liveCoverageItems(snap, 'original text plus some fact repeated', '<p>original plus some fact repeated</p>'), false);
    expect(after.overall).toBe(before.overall);
  });
});

describe('scoreAttribution', () => {
  const bucket = (key: BucketScore['key'], score: number): BucketScore => ({
    key, label: key, weight: 1, items: 1, covered: 1, earned: score, max: 100, score,
  });

  it('only positive bucket deltas, sorted desc, matched by key', () => {
    const before = [bucket('knowledge', 50), bucket('intent', 60), bucket('quality', 70)];
    const after = [bucket('knowledge', 80), bucket('intent', 65), bucket('quality', 70)];
    const result = scoreAttribution(before, after);
    expect(result).toEqual([
      { label: 'knowledge', delta: 30 },
      { label: 'intent', delta: 5 },
    ]);
  });

  it('drops equal and negative buckets', () => {
    const before = [bucket('knowledge', 50), bucket('intent', 60)];
    const after = [bucket('knowledge', 50), bucket('intent', 40)];
    expect(scoreAttribution(before, after)).toEqual([]);
  });
});

describe('remainingOpportunities', () => {
  it('counts only !covered items, grouped per TYPE (separate Entities/Facts/Questions/Structure rows)', () => {
    const items: CoverageItem[] = [
      item({ id: 'e1', type: 'entity', category: 'knowledge', covered: false }),
      item({ id: 'e2', type: 'entity', category: 'knowledge', covered: false }),
      item({ id: 'e3', type: 'entity', category: 'knowledge', covered: true }),
      item({ id: 'f1', type: 'fact', category: 'knowledge', covered: false }),
      item({ id: 'f2', type: 'fact', category: 'knowledge', covered: false }),
      item({ id: 'p1', type: 'paa', category: 'knowledge', covered: false }),
      item({ id: 's1', type: 'structure', category: 'quality', covered: false }),
    ];
    const result = remainingOpportunities(items);
    // entity/fact/paa share category 'knowledge' but MUST stay separate rows (spec example:
    // "Entities 0 · Facts 3 · Questions 2 · Structure 1") — never one lumped "Knowledge" row.
    const byLabel = new Map(result.map((r) => [r.label, r.count]));
    expect(byLabel.get('Entities')).toBe(2);
    expect(byLabel.get('Facts')).toBe(2);
    expect(byLabel.get('Questions')).toBe(1);
    expect(byLabel.get('Structure')).toBe(1);
    expect(result).toHaveLength(4);
  });

  it('empty when everything is covered', () => {
    const items: CoverageItem[] = [
      item({ id: 'e1', type: 'entity', covered: true }),
    ];
    expect(remainingOpportunities(items)).toEqual([]);
  });
});

describe('scoreDeltaGate', () => {
  it('(70,70) -> {animate:false, delta:0}', () => {
    expect(scoreDeltaGate(70, 70)).toEqual({ animate: false, delta: 0 });
  });
  it('(70,68) -> {animate:false, delta:-2}', () => {
    expect(scoreDeltaGate(70, 68)).toEqual({ animate: false, delta: -2 });
  });
  it('(70,73) -> {animate:true, delta:3}', () => {
    expect(scoreDeltaGate(70, 73)).toEqual({ animate: true, delta: 3 });
  });
  it('rounding: (70.4,71.6) -> delta 2', () => {
    expect(scoreDeltaGate(70.4, 71.6)).toEqual({ animate: true, delta: 2 });
  });
});
