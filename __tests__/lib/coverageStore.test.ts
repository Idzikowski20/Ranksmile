// __tests__/lib/coverageStore.test.ts
import { mergeCoverageItems, buildSnapshot, parseSnapshot } from '../../lib/coverageStore';
import { CoverageItem, CoverageResult } from '../../lib/aiCoverage';

const item = (id: string, type: CoverageItem['type'] = 'paa', category: CoverageItem['category'] = 'knowledge'): CoverageItem =>
  ({ id, label: id, type, category, importance: 'recommended', source: 'paa', covered: false, quality: 0 });

describe('mergeCoverageItems', () => {
  it('concatenates per-source arrays, ordered', () => {
    const merged = mergeCoverageItems({
      paa: [item('paa-1')],
      intent: [item('intent-1', 'intent', 'intent')],
      readability: [item('readability-1', 'readability', 'quality')],
      entity: [item('entity-1', 'entity', 'knowledge')],
    });
    expect(merged.map((i) => i.id)).toEqual(['paa-1', 'intent-1', 'readability-1', 'entity-1']);
  });
  it('dedupes by id, last source wins', () => {
    const dup = { ...item('paa-1'), quality: 4, covered: true };
    const merged = mergeCoverageItems({ paa: [item('paa-1')], intent: [dup], readability: [], entity: [] });
    expect(merged).toHaveLength(1);
    expect(merged[0].quality).toBe(4);
  });
  it('dedupes duplicate labels, keeping knowledge over intent', () => {
    const knowledge = { ...item('paa-citation-abc', 'paa', 'knowledge'), label: 'Kiedy można zgłosić nękanie?' };
    const intent = { ...item('intent-citation-xyz', 'intent', 'intent'), label: 'Kiedy można zgłosić nękanie?' };
    const merged = mergeCoverageItems({ paa: [knowledge], intent: [intent], readability: [], entity: [] });
    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe('paa');
  });
});

const META = { judgeVersion: 'v1|deepseek-chat|0', promptVersion: 'v1', model: 'deepseek-chat', createdAt: '2026-06-30T00:00:00Z' };

describe('buildSnapshot', () => {
  it('grades items, derives early flag, wraps with split version fields', () => {
    const items = [item('paa-1')];
    const result: CoverageResult = { items: [{ id: 'paa-1', covered: true, quality: 5, confidence: 1 }], answersMainQuestionEarly: false };
    const snap = buildSnapshot(items, result, META);
    expect(snap.schemaVersion).toBe(1);
    expect(snap.judgeVersion).toBe('v1|deepseek-chat|0');
    expect(snap.promptVersion).toBe('v1');
    expect(snap.model).toBe('deepseek-chat');
    expect(snap.items[0].covered).toBe(true);      // graded from the verdict
    expect(snap.items[0].quality).toBe(5);
    expect(snap.answersMainQuestionEarly).toBe(false);
    expect(snap.buckets).toHaveLength(5);          // intent/knowledge/authority/quality/style
    expect(snap.overall).toBe(85);
  });

  it('preserves missing/reason/needsExpansion/sectionId when a minimal verdict omits them (ai-readability re-grade)', () => {
    const items: CoverageItem[] = [{
      ...item('entity-1', 'entity', 'knowledge'),
      missing: ['x'], reason: 'r', needsExpansion: true, sectionId: 'sec-1',
    }];
    // Minimal verdict shape, as sent by the ai-readability endpoint — no missing/reason/needsExpansion/sectionId.
    const result: CoverageResult = { items: [{ id: 'entity-1', covered: true, quality: 4, confidence: 0.8 }], answersMainQuestionEarly: false };
    const snap = buildSnapshot(items, result, META);
    expect(snap.items[0].missing).toEqual(['x']);
    expect(snap.items[0].reason).toBe('r');
    expect(snap.items[0].needsExpansion).toBe(true);
    expect(snap.items[0].sectionId).toBe('sec-1');
    expect(snap.items[0].covered).toBe(true);   // covered/quality still update from the verdict
    expect(snap.items[0].quality).toBe(4);
  });

  it('still overrides missing/reason/needsExpansion/sectionId when the verdict provides them (deep-analysis path)', () => {
    const items: CoverageItem[] = [{
      ...item('entity-1', 'entity', 'knowledge'),
      missing: ['old'], reason: 'old-reason', needsExpansion: false, sectionId: 'old-sec',
    }];
    const result: CoverageResult = {
      items: [{
        id: 'entity-1', covered: true, quality: 5, confidence: 1,
        missing: ['new'], reason: 'new-reason', needsExpansion: true, sectionId: 'new-sec',
      }],
      answersMainQuestionEarly: false,
    };
    const snap = buildSnapshot(items, result, META);
    expect(snap.items[0].missing).toEqual(['new']);
    expect(snap.items[0].reason).toBe('new-reason');
    expect(snap.items[0].needsExpansion).toBe(true);
    expect(snap.items[0].sectionId).toBe('new-sec');
  });
});

describe('parseSnapshot', () => {
  it('returns null for non-snapshot input', () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot([])).toBeNull();                    // legacy array, not a snapshot
    expect(parseSnapshot({ schemaVersion: 99 })).toBeNull(); // unknown schema
    expect(parseSnapshot({ version: 1, items: [], buckets: [] })).toBeNull(); // v2 field name → rejected
  });
  it('round-trips a valid snapshot', () => {
    const items = [item('paa-1')];
    const result: CoverageResult = { items: [{ id: 'paa-1', covered: true, quality: 5, confidence: 1 }], answersMainQuestionEarly: false };
    const snap = buildSnapshot(items, result, META);
    expect(parseSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(snap);
  });
  it('parses a valid snapshot serialized as a JSON string (SQLite TEXT dialect)', () => {
    const items = [item('paa-1')];
    const result: CoverageResult = { items: [{ id: 'paa-1', covered: true, quality: 5, confidence: 1 }], answersMainQuestionEarly: false };
    const snap = buildSnapshot(items, result, META);
    const serialized = JSON.stringify(snap);
    const parsed = parseSnapshot(serialized);
    expect(parsed).toEqual(snap);
  });
  it('returns null for a malformed JSON string', () => {
    expect(parseSnapshot('{not json')).toBeNull();
    expect(parseSnapshot('{"incomplete')).toBeNull();
  });
  it('returns null for a string that parses to an array or wrong-schema object', () => {
    expect(parseSnapshot(JSON.stringify([{ schemaVersion: 1 }]))).toBeNull(); // parses to array
    expect(parseSnapshot(JSON.stringify({ schemaVersion: 2, items: [], buckets: [] }))).toBeNull(); // wrong version
    expect(parseSnapshot(JSON.stringify({ schemaVersion: 1, items: 'not-array' }))).toBeNull(); // items not array
  });
});
