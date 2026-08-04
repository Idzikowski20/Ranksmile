import { runCcmCompileCron } from '../../../lib/intelligence/ccmStaleCron';
import { InMemoryCompileStore } from '../../../lib/intelligence/compileStore';

const FIXED_AT = '2026-08-03T19:00:00.000Z';
const HTML = '<h1>Temat</h1><p>Rosja anektowała Krym w 2014 roku.</p>';
const HTML2 = '<h1>Temat</h1><p>Rosja anektowała Krym w 2014 roku. Update.</p>';

describe('runCcmCompileCron', () => {
  it('refreshes missing then skips when hash matches', async () => {
    const store = new InMemoryCompileStore();
    const first = await runCcmCompileCron({
      compiledAt: FIXED_AT,
      store,
      candidates: [{ articleId: 9, contentHtml: HTML }],
    });
    expect(first.scanned).toBe(1);
    expect(first.refreshed).toBe(1);
    expect(first.skipped).toBe(0);
    expect(first.failed).toBe(0);

    const second = await runCcmCompileCron({
      compiledAt: '2026-08-03T20:00:00.000Z',
      store,
      candidates: [{ articleId: 9, contentHtml: HTML }],
    });
    expect(second.refreshed).toBe(0);
    expect(second.skipped).toBe(1);

    const third = await runCcmCompileCron({
      compiledAt: '2026-08-03T21:00:00.000Z',
      store,
      candidates: [{ articleId: 9, contentHtml: HTML2 }],
    });
    expect(third.refreshed).toBe(1);
    expect(third.skipped).toBe(0);
  });

  it('counts empty content as failed empty_content', async () => {
    const store = new InMemoryCompileStore();
    const r = await runCcmCompileCron({
      compiledAt: FIXED_AT,
      store,
      candidates: [{ articleId: 1, contentHtml: '  ' }],
    });
    expect(r.failed).toBe(1);
    expect(r.results[0]?.ok).toBe(false);
  });
});
