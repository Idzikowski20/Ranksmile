/** @jest-environment node */
const query = jest.fn();

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: (...a: unknown[]) => query(...a) },
}));

const loadFresh = async () => {
  let mod: { ensureAiVisibilityTables: () => Promise<void> };
  await jest.isolateModulesAsync(async () => {
    mod = await import('../../lib/ensureAiVisibilityTables');
  });
  return mod!;
};

const ddlCount = () => query.mock.calls.length;

beforeEach(() => {
  query.mockReset().mockResolvedValue([]);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ensureAiVisibilityTables', () => {
  it('runs the DDL once and then short-circuits', async () => {
    const { ensureAiVisibilityTables } = await loadFresh();

    await ensureAiVisibilityTables();
    const first = ddlCount();
    expect(first).toBeGreaterThan(0);

    await ensureAiVisibilityTables();
    expect(ddlCount()).toBe(first);
  });

  // "already exists" is what the unguarded ALTER TABLE migrations raise on every run
  // after the first, so it must not count as a failure.
  it('still latches when a statement only reports the object already exists', async () => {
    const { ensureAiVisibilityTables } = await loadFresh();
    query.mockRejectedValueOnce(new Error('relation "ai_vis_configs" already exists'));

    await ensureAiVisibilityTables();
    const first = ddlCount();

    await ensureAiVisibilityTables();
    expect(ddlCount()).toBe(first);
  });

  // The regression this guards: /duplicate/ used to match, so a unique index that could
  // not be built over dirty rows was filed as routine and the schema latched as ready.
  it('retries after a duplicate-key failure instead of latching', async () => {
    const { ensureAiVisibilityTables } = await loadFresh();
    query.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "idx_ai_vis_generated_prompts_key"'),
    );

    await ensureAiVisibilityTables();
    const first = ddlCount();

    await ensureAiVisibilityTables();
    expect(ddlCount()).toBeGreaterThan(first);
  });

  // Concurrent first requests must share one pass, not each run the DDL and race to
  // decide the latch. Compared against a solo run: asserting only that a later call
  // adds nothing would pass even if both callers had run the statements twice.
  it('shares a single in-flight run between concurrent callers', async () => {
    const solo = await loadFresh();
    await solo.ensureAiVisibilityTables();
    const oneRun = ddlCount();

    query.mockClear();
    const concurrent = await loadFresh();
    await Promise.all([
      concurrent.ensureAiVisibilityTables(),
      concurrent.ensureAiVisibilityTables(),
    ]);

    expect(ddlCount()).toBe(oneRun);
  });
});
