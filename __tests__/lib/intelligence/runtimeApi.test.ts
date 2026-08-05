import { readFileSync } from 'fs';
import { join } from 'path';
import {
  compileArticle,
  getCcm,
  projectArticleIntelligence,
  resolveCompileSource,
} from '../../../lib/intelligence/runtimeApi';
import { InMemoryCompileStore } from '../../../lib/intelligence/compileStore';

const FIXED_AT = '2026-08-03T12:00:00.000Z';
const FIXTURE = readFileSync(
  join(__dirname, '../../fixtures/cias-001-hybrid-war.md'),
  'utf8',
);

/** Surfer AI Visibility gold atoms that must round-trip into FactNode.statement. */
const SURFER_GOLD_STATEMENTS = [
  'Rosja anektowała Krym w 2014',
  'Ukraina doświadczyła cyberataków przed 2022',
  'Kryzys migracyjny na granicy Polski miał miejsce w 2021',
  'Hezbollah użył metod hybrydowych w Libanie w 2006',
  'Agresor unika walki konwencjonalnej',
] as const;

describe('Etap 16 runtime API + Surfer gold parity', () => {
  it('resolveCompileSource strips HTML', () => {
    const src = resolveCompileSource({
      kind: 'html',
      html: '<h1>Hi</h1><p>Rosja anektowała Krym w 2014 roku.</p>',
    });
    expect(src.kind).toBe('plain');
    if (src.kind === 'plain') {
      expect(src.text).toContain('Rosja anektowała Krym');
      expect(src.text).not.toContain('<');
    }
  });

  it('compileArticle persists + getCcm round-trips', async () => {
    const store = new InMemoryCompileStore();
    const result = await compileArticle({
      articleId: 'art_16',
      compiledAt: FIXED_AT,
      source: { kind: 'plain', text: FIXTURE },
      store,
    });
    expect(result.noop).toBe(false);
    expect(result.view.coverage.totalFacts).toBeGreaterThan(0);
    expect(result.view.terms.length).toBeGreaterThan(0);

    const loaded = await getCcm('art_16', store);
    expect(loaded?.contentHash).toBe(result.model.contentHash);
    expect(loaded?.compiler.deterministicHash).toBe(
      result.model.compiler.deterministicHash,
    );
  });

  it('Surfer gold statements appear as FactNode.statement', async () => {
    const result = await compileArticle({
      articleId: 'cias-001-parity',
      compiledAt: FIXED_AT,
      source: { kind: 'plain', text: FIXTURE },
      persist: false,
    });
    const statements = result.view.facts.map((f) => f.statement);
    for (const gold of SURFER_GOLD_STATEMENTS) {
      expect(statements.some((s) => s.includes(gold) || gold.includes(s.slice(0, 40)))).toBe(
        true,
      );
    }
    const view = projectArticleIntelligence(result.model, result.actionGraph);
    expect(view.visibility.atomicFactCount).toBe(result.view.facts.length);
    expect(view.writing.overall).toBeGreaterThanOrEqual(0);
    expect(view.coverage.overall).toBeGreaterThan(0);
  });

  it('Surfer-like DTO has facts + terms + projections', async () => {
    const { view } = await compileArticle({
      articleId: 'dto',
      compiledAt: FIXED_AT,
      source: { kind: 'plain', text: FIXTURE },
      persist: false,
    });
    expect(view).toEqual(
      expect.objectContaining({
        coverage: expect.objectContaining({ overall: expect.any(Number) }),
        visibility: expect.objectContaining({ completeness: expect.any(Number) }),
        writing: expect.objectContaining({ overall: expect.any(Number) }),
        facts: expect.any(Array),
        terms: expect.any(Array),
        infoToCover: expect.objectContaining({ source: 'ccm' }),
        recommendations: expect.any(Array),
      }),
    );
    expect(view.terms.some((t) => /Rosja|Krym|Ukraina|Hezbollah/i.test(t))).toBe(true);
  });
});
