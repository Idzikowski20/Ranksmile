import { compile } from '../../../lib/compiler/compile';
import { applyLivePresence } from '../../../lib/intelligence/livePresence';
import { isFactNode } from '../../../lib/ccm/types/graph';

const FIXED_AT = '2026-08-03T17:00:00.000Z';

describe('applyLivePresence', () => {
  it('flips fact to missing when statement removed from text', () => {
    const { model } = compile({
      articleId: 'live-1',
      compiledAt: FIXED_AT,
      source: {
        kind: 'plain',
        text: '# Temat\n\nRosja anektowała Krym w 2014 roku mimo oporu.',
      },
    });
    const factsBefore = model.knowledge.graph.nodes.filter(isFactNode);
    expect(factsBefore.length).toBeGreaterThan(0);

    const gone = applyLivePresence(model, 'Całkiem inny tekst bez faktów hybrydowych.');
    expect(gone.changed).toBe(true);
    const factsAfter = gone.model.knowledge.graph.nodes.filter(isFactNode);
    expect(factsAfter.every((f) => f.status === 'missing')).toBe(true);
  });

  it('noop when text still contains statements', () => {
    const text = '# Temat\n\nRosja anektowała Krym w 2014 roku mimo oporu.';
    const { model } = compile({
      articleId: 'live-2',
      compiledAt: FIXED_AT,
      source: { kind: 'plain', text },
    });
    const again = applyLivePresence(model, text);
    // May flip weak→partial etc., but statements present → not all missing
    const facts = again.model.knowledge.graph.nodes.filter(isFactNode);
    expect(facts.some((f) => f.status === 'covered' || f.status === 'partial')).toBe(true);
  });
});
