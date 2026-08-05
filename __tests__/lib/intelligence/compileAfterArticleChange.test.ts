import {
  compileAfterArticleChange,
  compileIfStale,
  isCcmStale,
} from '../../../lib/intelligence/compileAfterArticleChange';
import { InMemoryCompileStore } from '../../../lib/intelligence/compileStore';

const FIXED_AT = '2026-08-03T14:00:00.000Z';
const HTML = '<h1>Wojna hybrydowa</h1><p>Rosja anektowała Krym w 2014 roku.</p>';
const HTML2 = '<h1>Wojna hybrydowa</h1><p>Rosja anektowała Krym w 2014 roku. Update.</p>';

describe('compileAfterArticleChange', () => {
  it('compiles + persists via injected store', async () => {
    const store = new InMemoryCompileStore();
    const r = await compileAfterArticleChange({
      articleId: 42,
      compiledAt: FIXED_AT,
      contentHtml: HTML,
      store,
      projectCoverage: false,
      enrichDaFacts: false,
      llmGaps: false,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.version).toBeGreaterThanOrEqual(1);
    const model = await store.get('42');
    expect(model?.contentHash).toBe(r.contentHash);
  });

  it('returns empty_content without throwing', async () => {
    const r = await compileAfterArticleChange({
      articleId: 1,
      compiledAt: FIXED_AT,
      contentHtml: '   ',
      store: new InMemoryCompileStore(),
      projectCoverage: false,
      enrichDaFacts: false,
      llmGaps: false,
    });
    expect(r).toEqual({ ok: false, error: 'empty_content' });
  });

  it('isCcmStale / compileIfStale skip when hash matches', async () => {
    const store = new InMemoryCompileStore();
    await compileAfterArticleChange({
      articleId: 7,
      compiledAt: FIXED_AT,
      contentHtml: HTML,
      store,
      projectCoverage: false,
      enrichDaFacts: false,
      llmGaps: false,
    });
    expect(await isCcmStale({ articleId: 7, contentHtml: HTML, store })).toBe(false);
    expect(await isCcmStale({ articleId: 7, contentHtml: HTML2, store })).toBe(true);

    const skip = await compileIfStale({
      articleId: 7,
      compiledAt: '2026-08-03T15:00:00.000Z',
      contentHtml: HTML,
      store,
      projectCoverage: false,
      enrichDaFacts: false,
      llmGaps: false,
    });
    expect(skip.ok).toBe(true);
    if (skip.ok) {
      expect(skip.skipped).toBe(true);
      expect(skip.noop).toBe(true);
    }

    const refreshed = await compileIfStale({
      articleId: 7,
      compiledAt: '2026-08-03T15:00:00.000Z',
      contentHtml: HTML2,
      store,
      projectCoverage: false,
      enrichDaFacts: false,
      llmGaps: false,
    });
    expect(refreshed.ok).toBe(true);
    if (refreshed.ok) {
      expect(refreshed.skipped).toBeFalsy();
      expect(await isCcmStale({ articleId: 7, contentHtml: HTML2, store })).toBe(false);
    }
  });
});
