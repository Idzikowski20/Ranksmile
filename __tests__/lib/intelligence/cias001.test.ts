import { readFileSync } from 'fs';
import { join } from 'path';
import { compile } from '../../../lib/compiler/compile';
import { buildActionGraph } from '../../../lib/planner/actionGraphBuilder';
import { projectCoverage } from '../../../lib/projections/coverageView';
import { diffModels, judgeModels } from '../../../lib/intelligence';
import { isEntityNode, isEvidenceSpanNode, isFactNode, isIntentNode } from '../../../lib/ccm/types/graph';

const FIXED_AT = '2026-08-03T10:00:00.000Z';
const FIXTURE = readFileSync(
  join(__dirname, '../../fixtures/cias-001-hybrid-war.md'),
  'utf8',
);

describe('CIAS-001 hybrid-war fixture', () => {
  it('compiles into CCM with intents, entities, dated evidence', () => {
    const { model } = compile({
      articleId: 'cias-001',
      compiledAt: FIXED_AT,
      profile: 'generic',
      source: { kind: 'plain', text: FIXTURE },
      ccmId: 'ccm_cias_001',
    });

    const intents = model.knowledge.graph.nodes.filter(isIntentNode);
    const facts = model.knowledge.graph.nodes.filter(isFactNode);
    const entities = model.knowledge.graph.nodes.filter(isEntityNode);
    const evidence = model.knowledge.graph.nodes.filter(isEvidenceSpanNode);

    expect(intents.length).toBeGreaterThanOrEqual(4);
    expect(intents.some((i) => i.primary && /wojna hybrydowa/i.test(i.label))).toBe(true);
    expect(facts.length).toBeGreaterThanOrEqual(4);
    expect(entities.some((e) => e.canonicalName === 'Rosja')).toBe(true);
    expect(entities.some((e) => e.canonicalName === 'Krym')).toBe(true);
    expect(evidence.some((e) => e.evidenceKind === 'date')).toBe(true);
    expect(model.knowledge.graph.edges.some((e) => e.type === 'supportedBy')).toBe(true);

    const cov = projectCoverage(model);
    expect(cov.totalFacts).toBe(facts.length);
    expect(cov.factsWithEvidence).toBeGreaterThanOrEqual(1);
    expect(cov.overall).toBeGreaterThan(0);

    const ag = buildActionGraph(model, { builtAt: FIXED_AT });
    expect(ag.fromKnowledgeGraphHash).toHaveLength(64);
    expect(ag.actions.length).toBeGreaterThanOrEqual(1);
  });

  it('identical recompile → ModelDiff identicalCompile + Judge unchanged', () => {
    const opts = {
      articleId: 'cias-001',
      compiledAt: FIXED_AT,
      source: { kind: 'plain' as const, text: FIXTURE },
    };
    const a = compile(opts).model;
    const b = compile({ ...opts, compiledAt: '2099-01-01T00:00:00.000Z' }).model;
    const diff = diffModels(a, b);
    expect(diff.identicalCompile).toBe(true);
    const verdict = judgeModels(a, b);
    expect(verdict.verdict).toBe('unchanged');
  });
});
