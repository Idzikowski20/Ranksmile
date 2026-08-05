import { compile } from '../../../lib/compiler/compile';
import { isFactNode } from '../../../lib/ccm/types/graph';
import { enrichCcmWithDaFacts } from '../../../lib/intelligence/enrichCcmWithDaFacts';
import { citationsToDaFactSeeds } from '../../../lib/intelligence/loadDaFactSeeds';
import { projectCcmToCoverageSnapshot } from '../../../lib/intelligence/ccmToCoverageSnapshot';

const FIXED_AT = '2026-08-03T16:00:00.000Z';

function isQuestion(n: { kind: string }): boolean {
  return n.kind === 'question';
}

function isCitation(n: { kind: string }): boolean {
  return n.kind === 'citation';
}

describe('Fact Engine v2 — DA citation enrichment', () => {
  it('citationsToDaFactSeeds maps answer + readiness', () => {
    const plain = 'Szantaż jest przestępstwem w kodeksie karnym. Ofiara powinna zgłosić sprawę na policję.';
    const seeds = citationsToDaFactSeeds(
      [
        {
          prompt: 'Czym jest szantaż?',
          answer: 'Szantaż jest przestępstwem polegającym na wymuszaniu korzyści.',
          cited_url: 'https://example.com/a',
          cited_domain: 'example.com',
        },
        {
          prompt: 'Krótki',
          answer: '',
          cited_url: null,
          cited_domain: null,
        },
      ],
      plain,
    );
    expect(seeds.length).toBe(1);
    expect(seeds[0].statement.toLowerCase()).toContain('przestępstw');
    expect(seeds[0].url).toBe('https://example.com/a');
    expect(seeds[0].readiness).toBeGreaterThan(0);
  });

  it('enrichCcmWithDaFacts adds facts + citation + evidence when covered', () => {
    const { model } = compile({
      articleId: 'da-enrich',
      compiledAt: FIXED_AT,
      source: {
        kind: 'plain',
        text:
          '# Szantaż\n\n## Definicja\n\nSzantaż jest przestępstwem w kodeksie karnym. Ofiara powinna zgłosić sprawę na policję.\n',
      },
    });
    const plain = model.ast.blocks.map((b) => b.text).join(' ');
    const seeds = citationsToDaFactSeeds(
      [
        {
          prompt: 'Jak reagować na szantaż?',
          answer: 'Ofiara powinna zgłosić sprawę na policję niezwłocznie po zagrożeniu.',
          cited_url: 'https://example.com/kk',
          cited_domain: 'example.com',
        },
        {
          prompt: 'Czego brakuje całkowicie w artykule xyzzy?',
          answer: 'Kompletnie niepowiązany fakt o kwarkach i gluonach w CERN.',
          cited_url: null,
          cited_domain: null,
        },
      ],
      plain,
    );
    const enriched = enrichCcmWithDaFacts(model, seeds);
    const facts = enriched.knowledge.graph.nodes.filter(isFactNode);
    const before = model.knowledge.graph.nodes.filter(isFactNode).length;
    expect(facts.length).toBeGreaterThan(before);
    expect(enriched.knowledge.graph.nodes.some(isCitation)).toBe(true);
    expect(enriched.knowledge.graph.nodes.some(isQuestion)).toBe(true);
    expect(enriched.compiler.notes.some((n) => n.startsWith('da-facts:'))).toBe(true);

    const snap = projectCcmToCoverageSnapshot(enriched, { createdAt: FIXED_AT });
    expect(snap.items.length).toBeGreaterThanOrEqual(facts.length);
    expect(snap.overall).toBeGreaterThan(0);
  });
});
