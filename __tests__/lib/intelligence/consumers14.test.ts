import { compile } from '../../../lib/compiler/compile';
import {
  createConsumerContext,
  coverageConsumer,
  visibilityConsumer,
  actionGraphConsumer,
  judgeConsumer,
  benchmarkConsumer,
  runBenchmark,
  InMemoryCompileStore,
  createHistoryConsumer,
} from '../../../lib/intelligence';
import { plannerConsumer } from '../../../lib/planner';

const AT = '2026-08-03T16:00:00.000Z';

describe('Etap 14 ConsumerContext + Benchmark + persistence', () => {
  it('consumers accept(context) for coverage/visibility/actionGraph', () => {
    const { model } = compile({
      articleId: 'c14',
      compiledAt: AT,
      source: {
        kind: 'plain',
        text: '# Temat\n\nRosja anektowała Krym w 2014 roku.',
      },
    });
    const ctx = createConsumerContext({ model });
    const cov = coverageConsumer.accept(ctx);
    expect(cov.consumerId).toBe('coverage_projection');
    expect(cov.result.totalFacts).toBeGreaterThanOrEqual(1);

    const vis = visibilityConsumer.accept(ctx);
    expect(vis.consumerId).toBe('visibility_projection');
    expect(vis.result.atomicFactCount).toBeGreaterThanOrEqual(1);

    const ag = actionGraphConsumer.accept(ctx);
    expect(ag.result.actions.length).toBeGreaterThanOrEqual(1);

    const plan = plannerConsumer.accept(
      createConsumerContext({ model, actionGraph: ag.result, budget: { maxActions: 2, maxLlmCalls: 0 } }),
    );
    expect(plan.result.selected.length).toBeLessThanOrEqual(2);
    expect(plan.result.selected.length + plan.result.deferred.length).toBe(
      ag.result.actions.length,
    );
  });

  it('benchmark finds gaps for weak/short facts and intents', () => {
    const { model } = compile({
      articleId: 'b14',
      compiledAt: AT,
      source: { kind: 'plain', text: '# Alone\n\nHi.' },
    });
    const report = runBenchmark(model);
    expect(report.patternsChecked).toBeGreaterThanOrEqual(1);
    expect(report.gaps.length).toBeGreaterThanOrEqual(1);
    const ctx = createConsumerContext({ model });
    const out = benchmarkConsumer.accept(ctx);
    expect(out.consumerId).toBe('benchmark');
    expect(out.result.gaps.length).toBeGreaterThanOrEqual(1);
  });

  it('judge consumer with prior model', () => {
    const a = compile({
      articleId: 'j14',
      compiledAt: AT,
      source: { kind: 'plain', text: '# A\n\nShort body text here.' },
    }).model;
    const b = compile({
      articleId: 'j14',
      compiledAt: AT,
      version: 2,
      source: {
        kind: 'plain',
        text: '# A\n\nRosja w 2014 zajęła Krym mimo oporu lokalnego.',
      },
    }).model;
    const verdict = judgeConsumer.accept(createConsumerContext({ model: b, priorModel: a }));
    expect(verdict.result.diff.identicalCompile).toBe(false);
  });

  it('InMemoryCompileStore persists snapshot + events', async () => {
    const store = new InMemoryCompileStore();
    const { model } = compile({
      articleId: 'h14',
      compiledAt: AT,
      source: { kind: 'plain', text: '# H\n\nRosja 2014 Krym zajęty.' },
    });
    const history = createHistoryConsumer(store);
    const ack = await history.accept(createConsumerContext({ model }));
    expect(ack.result.eventCount).toBeGreaterThanOrEqual(2);
    expect((await store.get('h14'))?.compiler.deterministicHash).toBe(
      model.compiler.deterministicHash,
    );
    expect((await store.listEvents('h14')).some((e) => e.type === 'CompileFinished')).toBe(
      true,
    );
  });
});
