import { compile } from '../../../lib/compiler/compile';
import { graphQuery } from '../../../lib/ccm/graphQuery';
import {
  buildInvalidationGraph,
  getDependencyGraph,
} from '../../../lib/compiler/incremental';

const AT = '2026-08-03T12:00:00.000Z';

describe('graphQuery + incremental runtime', () => {
  it('graphQuery finds facts with evidence and subgraph supports path', () => {
    const { model } = compile({
      articleId: 'gq1',
      compiledAt: AT,
      source: {
        kind: 'plain',
        text: '# Temat\n\nRosja anektowała Krym w 2014 roku.',
      },
    });
    const q = graphQuery(model);
    expect(q.findFacts({ hasEvidence: true }).length).toBeGreaterThanOrEqual(1);
    expect(q.findEntities({ canonicalName: 'Rosja' })).toHaveLength(1);
    expect(q.findIntents({ primary: true }).length).toBeGreaterThanOrEqual(1);

    const matches = q.findSubgraph({
      rootKind: 'fact',
      edgePath: ['supportedBy'],
    });
    expect(matches.some((m) => m.missingRoles.length === 0)).toBe(true);

    const fact = q.findFacts()[0];
    expect(fact).toBeDefined();
    if (!fact) return;
    const path = q.traverse(fact.id, { edgeTypes: ['uses', 'supportedBy'], maxDepth: 2 });
    expect(path[0]).toBe(fact.id);
    expect(path.length).toBeGreaterThan(1);
  });

  it('incremental noop when previous contentHash matches and no dirty blocks', () => {
    const first = compile({
      articleId: 'inc1',
      compiledAt: AT,
      source: { kind: 'plain', text: '# A\n\nBody with Rosja 2014.' },
    });
    const second = compile({
      articleId: 'inc1',
      compiledAt: '2099-01-01T00:00:00.000Z',
      mode: 'incremental',
      previous: first.model,
      source: { kind: 'plain', text: '# A\n\nBody with Rosja 2014.' },
      dirtyBlockIds: [],
    });
    expect(second.noop).toBe(true);
    expect(second.model).toBe(first.model);
    expect(second.dependencyGraph.blockToFactIds).toBeDefined();
  });

  it('incremental with dirty blocks sets mode and invalidation passes', () => {
    const first = compile({
      articleId: 'inc2',
      compiledAt: AT,
      source: { kind: 'plain', text: '# A\n\nOld paragraph here for length.' },
    });
    const dirty = first.model.ast.blocks.find((b) => b.type === 'paragraph')?.blockId;
    expect(dirty).toBeDefined();
    const inv = buildInvalidationGraph(first.model, dirty ? [dirty] : []);
    expect(inv.dirtyPassIds).toEqual(expect.arrayContaining(['fact', 'evidence', 'intent']));

    const second = compile({
      articleId: 'inc2',
      compiledAt: AT,
      version: 2,
      mode: 'incremental',
      previous: first.model,
      dirtyBlockIds: dirty ? [dirty] : [],
      source: {
        kind: 'plain',
        text: '# A\n\nRosja anektowała Krym w 2014 roku na wschodzie.',
      },
    });
    expect(second.noop).toBe(false);
    expect(second.model.compiler.mode).toBe('incremental');
    expect(second.model.compiler.capabilities.incremental).toBe(true);
    expect(second.invalidationGraph?.dirtyBlockIds).toContain(dirty);
    expect(getDependencyGraph(second.model).blockToFactIds).toBeDefined();
  });
});
