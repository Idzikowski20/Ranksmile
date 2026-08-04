import { compile } from '../../../lib/compiler/compile';
import {
  createConsumerContext,
  coverageConsumer,
  visibilityConsumer,
  writingIntelligenceConsumer,
  editorialIntelligenceConsumer,
  optimizationIntelligenceConsumer,
  buildWiScorecard,
  InMemoryCompileStore,
  acceptHistoryAsync,
  ccmToBlob,
  ccmFromBlob,
  actionGraphConsumer,
} from '../../../lib/intelligence';
import { buildActionGraph } from '../../../lib/planner';

const AT = '2026-08-03T18:00:00.000Z';

describe('Etap 15 Writing Intelligence + CompileStore', () => {
  it('WI scorecard uses presentation/structure only without peers', () => {
    const { model } = compile({
      articleId: 'wi1',
      compiledAt: AT,
      source: {
        kind: 'plain',
        text: '# Temat\n\nRosja anektowała Krym w 2014 roku mimo oporu.',
      },
    });
    const ctx = createConsumerContext({ model });
    const card = buildWiScorecard(ctx);
    expect(card.dimensions.some((d) => d.key === 'clarity')).toBe(true);
    expect(card.dimensions.some((d) => d.key === 'structure')).toBe(true);
    expect(card.usedPeerResults).toEqual([]);
    expect(card.overall).toBeGreaterThanOrEqual(0);
  });

  it('WI consumer folds peer coverage + visibility', () => {
    const { model } = compile({
      articleId: 'wi2',
      compiledAt: AT,
      source: {
        kind: 'plain',
        text: '# Temat\n\nRosja anektowała Krym w 2014 roku mimo oporu lokalnego.',
      },
    });
    const base = createConsumerContext({ model });
    const cov = coverageConsumer.accept(base).result;
    const vis = visibilityConsumer.accept(base).result;
    const out = writingIntelligenceConsumer.accept(
      createConsumerContext({
        model,
        peerResults: { coverage: cov, visibility: vis },
      }),
    );
    expect(out.consumerId).toBe('writing_intelligence');
    expect(out.result.usedPeerResults).toEqual(
      expect.arrayContaining(['coverage', 'visibility']),
    );
    expect(out.result.dimensions.some((d) => d.key === 'peer_coverage')).toBe(true);
  });

  it('editorial + optimization meta-consumers', () => {
    const { model } = compile({
      articleId: 'wi3',
      compiledAt: AT,
      source: { kind: 'plain', text: '# T\n\nBody with enough length for a fact.' },
    });
    const ag = buildActionGraph(model, { builtAt: AT });
    const ed = editorialIntelligenceConsumer.accept(createConsumerContext({ model }));
    expect(ed.consumerId).toBe('editorial_intelligence');
    expect(typeof ed.result.publishReady).toBe('boolean');

    const opt = optimizationIntelligenceConsumer.accept(
      createConsumerContext({
        model,
        actionGraph: ag,
        peerResults: {
          coverage: coverageConsumer.accept(createConsumerContext({ model })).result,
        },
      }),
    );
    expect(opt.result.actionCount).toBe(ag.actions.length);
  });

  it('ccm blob roundtrip for DB column storage', () => {
    const { model } = compile({
      articleId: 'blob1',
      compiledAt: AT,
      source: { kind: 'plain', text: '# A\n\nRosja 2014.' },
    });
    const blob = ccmToBlob(model);
    const back = ccmFromBlob(blob);
    expect(back?.compiler.deterministicHash).toBe(model.compiler.deterministicHash);
    expect(back?.articleId).toBe('blob1');
  });

  it('acceptHistoryAsync + InMemoryCompileStore', async () => {
    const store = new InMemoryCompileStore();
    const { model } = compile({
      articleId: 'hist15',
      compiledAt: AT,
      source: { kind: 'plain', text: '# H\n\nRosja 2014 Krym.' },
    });
    const ag = actionGraphConsumer.accept(createConsumerContext({ model })).result;
    const ack = await acceptHistoryAsync(
      store,
      createConsumerContext({ model, actionGraph: ag }),
    );
    expect(ack.result.articleId).toBe('hist15');
    expect(await store.get('hist15')).not.toBeNull();
    expect((await store.listEvents('hist15')).length).toBeGreaterThanOrEqual(2);
  });
});
