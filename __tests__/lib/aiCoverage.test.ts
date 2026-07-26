// __tests__/lib/aiCoverage.test.ts
// Local sequelize mock — paaCoverageItems (lib/seo/keywordData) transitively imports
// utils/searchConsole -> database/database + database/models/gscAccount, which pull in
// real sequelize-typescript (ESM uuid dep) and crash Jest. Kept local (not a root
// __mocks__/) so it can't affect unrelated suites. Mirrors __tests__/lib/domainPipeline.test.ts.
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn(), transaction: jest.fn() } }));
jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT', UPDATE: 'UPDATE' } }));
jest.mock('../../database/models/gscAccount', () => ({ __esModule: true, default: { findAll: jest.fn().mockResolvedValue([]) } }));
jest.mock('@googleapis/searchconsole', () => ({ searchconsole_v1: { Searchconsole: jest.fn() } }));

import {
  computeCoverageScores, computeBucketScore, blendBuckets, earlyAnswerBonus,
  CoverageItem,
} from '../../lib/aiCoverage';
import { paaCoverageItems } from '../../lib/seo/keywordData';

// GRADED item factory — the scorer works on graded items (covered/quality baked in), NOT CoverageResult.
const gi = (
  id: string,
  covered: boolean,
  quality: number,
  category: CoverageItem['category'] = 'knowledge',
  importance: CoverageItem['importance'] = 'recommended',
): CoverageItem => ({
  id, label: id, type: 'paa', category, importance,
  source: 'paa', covered, quality,
});

describe('computeCoverageScores', () => {
  it('no items → overall 0, 5 empty buckets (intent/knowledge/authority/quality/style)', () => {
    const { overall, buckets } = computeCoverageScores([], false);
    expect(overall).toBe(0);
    expect(buckets.map((b) => b.key)).toEqual(['intent', 'knowledge', 'authority', 'quality', 'style']);
    expect(buckets.every((b) => b.score === 0 && b.items === 0)).toBe(true);
  });
  it('all covered q5 + early → overall 100', () => {
    const items = [gi('a', true, 5, 'knowledge'), gi('b', true, 5, 'intent', 'critical')];
    expect(computeCoverageScores(items, true).overall).toBe(100);
  });
  it('all covered q5, no early → overall 85', () => {
    const items = [gi('a', true, 5, 'knowledge'), gi('b', true, 5, 'intent', 'critical')];
    expect(computeCoverageScores(items, false).overall).toBe(85);
  });
  it('quality matters: single knowledge item covered q1 → bucket score 20', () => {
    const { buckets } = computeCoverageScores([gi('a', true, 1, 'knowledge')], false);
    expect(buckets.find((b) => b.key === 'knowledge')?.score).toBe(20);
  });
  it('empty bucket contributes 0 weight (paa-only article not dragged by empty intent)', () => {
    const { overall, buckets } = computeCoverageScores([gi('a', true, 5, 'knowledge')], false);
    expect(overall).toBe(85);                 // knowledge fully covered, no early
    expect(buckets.find((b) => b.key === 'intent')?.items).toBe(0);
    expect(buckets.find((b) => b.key === 'intent')?.score).toBe(0);
  });
  it('per-bucket importance weighting: critical covered + optional uncovered → knowledge bucket 75', () => {
    const items = [gi('a', true, 5, 'knowledge', 'critical'), gi('b', false, 0, 'knowledge', 'optional')];
    // earned = 3×1 = 3 ; max = 3+1 = 4 ; 3/4 = 75
    expect(computeCoverageScores(items, false).buckets.find((b) => b.key === 'knowledge')?.score).toBe(75);
  });
  it('non-finite quality (NaN, or a string from a malformed judge reply) is guarded to 0, not NaN-poisoned', () => {
    const nanItem = gi('a', true, NaN, 'knowledge');
    const stringItem = { ...gi('b', true, 3, 'knowledge'), quality: 'oops' as unknown as number };
    const { overall, buckets } = computeCoverageScores([nanItem], false);
    expect(Number.isFinite(overall)).toBe(true);
    // covered + quality 0 still gets soft floor (checklist checkmark ≠ AI gauge 0)
    expect(overall).toBe(1);
    expect(Number.isFinite(buckets.find((b) => b.key === 'knowledge')?.score)).toBe(true);

    const strResult = computeCoverageScores([stringItem], false);
    expect(Number.isFinite(strResult.overall)).toBe(true);
    expect(strResult.overall).toBe(1);
  });

  it('soft floor: a few quality covers do not round to 0 under a huge uncovered max', () => {
    const items = [
      gi('covered', true, 4, 'style', 'recommended'),
      ...Array.from({ length: 40 }, (_, i) => gi(`u${i}`, false, 0, 'knowledge', 'critical')),
    ];
    const { overall } = computeCoverageScores(items, false);
    expect(overall).toBeGreaterThanOrEqual(2);
    expect(overall).toBeLessThan(20);
  });

  it('soft floor: covered checklist items with quality 0 still raise AI score above 0', () => {
    // Judge (or stale snap) can mark covered:true with quality:0 → UI "Covered" + AI gauge 0.
    const items = [
      gi('q1', true, 0, 'knowledge', 'recommended'),
      gi('q2', true, 0, 'knowledge', 'recommended'),
      gi('q3', true, 0, 'knowledge', 'recommended'),
      gi('q4', true, 0, 'knowledge', 'recommended'),
      ...Array.from({ length: 40 }, (_, i) => gi(`u${i}`, false, 0, 'knowledge', 'critical')),
    ];
    const { overall } = computeCoverageScores(items, false);
    expect(overall).toBeGreaterThan(0);
  });
});

// The swappable helpers are exported + tested in isolation so weight/algorithm changes
// can't silently break the blend (3rd-review risk). They read graded items — no verdict map (4th-review).
describe('scoring helpers (isolated)', () => {
  it('computeBucketScore: only counts items in its category; empty → max 0, score 0', () => {
    const items = [gi('a', true, 5, 'knowledge'), gi('b', true, 5, 'intent', 'critical')];
    const empty = computeBucketScore('authority', items);
    expect(empty.items).toBe(0);
    expect(empty.max).toBe(0);
    expect(empty.score).toBe(0);
    const knowledge = computeBucketScore('knowledge', items);
    expect(knowledge.items).toBe(1);
    expect(knowledge.covered).toBe(1);
    expect(knowledge.score).toBe(100);
  });

  it('blendBuckets: weights buckets by BucketScore.weight; all-empty → 0', () => {
    expect(blendBuckets([])).toBe(0);
    const buckets = computeCoverageScores([gi('a', true, 5, 'knowledge')], false).buckets;
    // knowledge fully covered, all other buckets empty (weight-0 contribution) → base 85
    expect(Math.round(blendBuckets(buckets))).toBe(85);
  });

  it('earlyAnswerBonus: 15 when flagged, 0 otherwise', () => {
    expect(earlyAnswerBonus(true)).toBe(15);
    expect(earlyAnswerBonus(false)).toBe(0);
  });
});

// checkCoverage + intentItems + hashId tests
import { checkCoverage, intentItems, hashId, CoverageJudge, sanitizeVerdict } from '../../lib/aiCoverage';

const paaItems: CoverageItem[] = [
  { id: 'paa-x', label: 'Q1?', type: 'paa', category: 'knowledge', importance: 'recommended', source: 'paa', covered: false, quality: 0 },
];
const judge = (run: CoverageJudge['run']): CoverageJudge => ({ version: 'test-v1', run });

describe('checkCoverage', () => {
  it('empty items → no judge call', async () => {
    const run = jest.fn();
    expect(await checkCoverage('t', [], judge(run as never))).toEqual({ items: [], answersMainQuestionEarly: false });
    expect(run).not.toHaveBeenCalled();
  });
  it('drops unknown + duplicate ids, keeps verdict fields', async () => {
    const j = judge(async () => ({ items: [
      { id: 'paa-x', covered: true, quality: 4, confidence: 0.9, missing: ['dosage'] },
      { id: 'paa-x', covered: false, quality: 0, confidence: 1 },
      { id: 'ghost', covered: true, quality: 5, confidence: 1 },
    ], answersMainQuestionEarly: true }));
    const r = await checkCoverage('body', paaItems, j);
    expect(r.items).toEqual([{ id: 'paa-x', covered: true, quality: 4, confidence: 0.9, missing: ['dosage'] }]);
    expect(r.answersMainQuestionEarly).toBe(true);
  });
  it('caches by version+ids+hash (run called once)', async () => {
    const run = jest.fn(async () => ({ items: [], answersMainQuestionEarly: false }));
    await checkCoverage('same', paaItems, judge(run));
    await checkCoverage('same', paaItems, judge(run));
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('cache hits are independent copies — mutating a returned result does not poison later calls', async () => {
    const run = jest.fn(async () => ({
      items: [{ id: 'paa-x', covered: true, quality: 3, confidence: 0.5 }],
      answersMainQuestionEarly: false,
    }));
    const j = judge(run);
    const first = await checkCoverage('poison-me', paaItems, j);
    first.items.push({ id: 'ghost', covered: true, quality: 5, confidence: 1 });
    (first as { answersMainQuestionEarly: boolean }).answersMainQuestionEarly = true;

    const second = await checkCoverage('poison-me', paaItems, j);
    expect(run).toHaveBeenCalledTimes(1); // still a cache hit
    expect(second.answersMainQuestionEarly).toBe(false);
    expect(second.items).toEqual([{ id: 'paa-x', covered: true, quality: 3, confidence: 0.5 }]);
  });
  it('non-array verdict.items degrades to [] instead of throwing', async () => {
    const j = judge(async () => ({ items: 'oops' as any, answersMainQuestionEarly: false }));
    const result = await checkCoverage('malformed', paaItems, j);
    expect(result).toEqual({ items: [], answersMainQuestionEarly: false });
  });
});

describe('sanitizeVerdict', () => {
  it('coerces bad field types to safe defaults, keeps valid rows', () => {
    const out = sanitizeVerdict([
      { id: 'a', covered: true,   quality: 'high', confidence: 2,   missing: ['x', 3, null], sectionId: 5 },
      { id: 'b', covered: 'true', quality: 4,      confidence: 0.9, missing: 'nope' },
    ]);
    // row a: quality 'high' -> 0; confidence 2 -> clamped 1; missing filtered to ['x']; sectionId 5 (number) -> undefined
    expect(out[0]).toEqual({ id: 'a', covered: true, quality: 0, confidence: 1, missing: ['x'] });
    // row b: covered 'true' (stringified bool) -> true; missing 'nope' (non-array) -> undefined
    expect(out[1]).toEqual({ id: 'b', covered: true, quality: 4, confidence: 0.9 });
  });
  it('covered: only real true or the string "true" -> true; "false"/"0"/{}/[] -> false (no truthy coercion)', () => {
    const out = sanitizeVerdict([
      { id: 't1', covered: true,    quality: 5, confidence: 1 },
      { id: 't2', covered: 'true',  quality: 5, confidence: 1 },
      { id: 'f1', covered: 'false', quality: 5, confidence: 1 },
      { id: 'f2', covered: '0',     quality: 5, confidence: 1 },
      { id: 'f3', covered: {},      quality: 5, confidence: 1 },
      { id: 'f4', covered: [],      quality: 5, confidence: 1 },
    ]);
    expect(out.map((r) => r.covered)).toEqual([true, true, false, false, false, false]);
  });
  it('drops rows without a string id', () => {
    expect(sanitizeVerdict([{ covered: true, quality: 5, confidence: 1 }, { id: 7 }])).toEqual([]);
  });
  it('non-array input -> [] (does not throw)', () => {
    expect(sanitizeVerdict(null)).toEqual([]);
    expect(sanitizeVerdict({ items: [] })).toEqual([]);
    expect(sanitizeVerdict('nope')).toEqual([]);
  });
});

describe('intentItems', () => {
  it('returns 5 fixed ids with category:intent; answer-main + answer-early are critical', () => {
    const it = intentItems();
    expect(it.map((x) => x.id)).toEqual([
      'intent-answer-main', 'intent-answer-early',
      'intent-expectations', 'intent-who', 'intent-why',
    ]);
    expect(it[0].importance).toBe('critical');
    expect(it[1].importance).toBe('critical');
    expect(it.slice(2).every((x) => x.importance === 'recommended')).toBe(true);
    expect(it.every((x) => x.type === 'intent' && x.category === 'intent' && x.source === 'llm')).toBe(true);
  });
});

describe('hashId', () => {
  it('is stable + differs by input', () => {
    expect(hashId('abc')).toBe(hashId('abc'));
    expect(hashId('abc')).not.toBe(hashId('abd'));
  });
});

describe('paaCoverageItems', () => {
  it('stable hashed ids regardless of order; category:knowledge', () => {
    const a = paaCoverageItems([{ question: 'What is X?' }, { question: 'How does Y work?' }]);
    const b = paaCoverageItems([{ question: 'How does Y work?' }, { question: 'What is X?' }]);
    expect(a.map((i) => i.id).sort()).toEqual(b.map((i) => i.id).sort());
    expect(a[0].type).toBe('paa');
    expect(a[0].category).toBe('knowledge');
    expect(a[0].source).toBe('paa');
    expect(a[0].importance).toBe('recommended');
  });
  it('returns [] for empty input', () => {
    expect(paaCoverageItems([])).toEqual([]);
  });
});
