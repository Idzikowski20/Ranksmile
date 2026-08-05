import { compile } from '../../../lib/compiler/compile';
import { applyContradictHeuristics } from '../../../lib/intelligence/applyContradictHeuristics';
import { enrichCcmWithDaFacts } from '../../../lib/intelligence/enrichCcmWithDaFacts';
import {
  getCcmCompileMetricsSummary,
  recordCcmCompileMetric,
  resetCcmCompileMetrics,
} from '../../../lib/intelligence/ccmCompileMetrics';
import { applyLlmGapEvidence } from '../../../lib/intelligence/applyLlmGapEvidence';
import { isFactNode } from '../../../lib/ccm/types/graph';

const FIXED_AT = '2026-08-03T17:00:00.000Z';

describe('Etap 29–30 hardening + gap evidence', () => {
  it('recordCcmCompileMetric accumulates totals', () => {
    resetCcmCompileMetrics();
    recordCcmCompileMetric({ articleId: 1, outcome: 'ok', ms: 12 });
    recordCcmCompileMetric({ articleId: 2, outcome: 'skipped', ms: 3 });
    recordCcmCompileMetric({ articleId: 3, outcome: 'error', ms: 1, error: 'x' });
    const s = getCcmCompileMetricsSummary();
    expect(s.totals.ok).toBe(1);
    expect(s.totals.skipped).toBe(1);
    expect(s.totals.error).toBe(1);
    expect(s.recent).toHaveLength(3);
  });

  it('applyContradictHeuristics links myth vs exception', () => {
    const { model } = compile({
      articleId: 'contradict-1',
      compiledAt: FIXED_AT,
      source: {
        kind: 'plain',
        text: `# RODO\n\n## Definicja\n\nArtykuł opisuje prawo do usunięcia danych osobowych.\n`,
      },
    });
    const seeded = enrichCcmWithDaFacts(model, [
      {
        id: 'da_myth',
        statement: 'Dane osobowe zawsze muszą zostać usunięte na żądanie użytkownika.',
        prompt: 'Czy zawsze muszą usunąć dane osobowe?',
        readiness: 10,
      },
      {
        id: 'da_exc',
        statement: 'Dane osobowe nie zawsze muszą zostać usunięte — wyjątki prawne RODO.',
        prompt: 'Kiedy dane osobowe nie muszą?',
        readiness: 10,
      },
    ]);
    const out = applyContradictHeuristics(seeded);
    expect(out.knowledge.graph.edges.some((e) => e.type === 'contradicts')).toBe(true);
    expect(out.compiler.notes.some((n) => n.startsWith('contradicts:'))).toBe(true);
  });

  it('applyLlmGapEvidence bumps weak fact to covered', () => {
    const { model } = compile({
      articleId: 'llm-gap-1',
      compiledAt: FIXED_AT,
      source: {
        kind: 'plain',
        text: '# T\n\n## S\n\nOfiara powinna zgłosić sprawę na policję po szantażu.\n',
      },
    });
    const seeded = enrichCcmWithDaFacts(model, [
      {
        id: 'da_gap_1',
        statement: 'Całkowicie niepowiązany temat o kwarkach w CERN bez pokrycia.',
        prompt: 'Co z kwarkami?',
        readiness: 5,
      },
    ]);
    const weak = seeded.knowledge.graph.nodes.filter(isFactNode).find((f) => f.id === 'da_gap_1');
    expect(weak?.status === 'missing' || weak?.status === 'weak').toBe(true);

    const bumped = applyLlmGapEvidence(seeded, [
      {
        id: 'da_gap_1',
        quote: 'Ofiara powinna zgłosić sprawę na policję po szantażu.',
      },
    ]);
    const fact = bumped.knowledge.graph.nodes.filter(isFactNode).find((f) => f.id === 'da_gap_1');
    expect(fact?.status).toBe('covered');
    expect(bumped.compiler.notes.some((n) => n.startsWith('llm-gaps:'))).toBe(true);
  });
});
