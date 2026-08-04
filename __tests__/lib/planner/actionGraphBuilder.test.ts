import { compile } from '../../../lib/compiler/compile';
import { buildActionGraph } from '../../../lib/planner/actionGraphBuilder';

const FIXED_AT = '2026-08-03T08:00:00.000Z';
const BUILT_AT = '2026-08-03T08:01:00.000Z';

describe('actionGraph builder', () => {
  it('builds DSL actions with fromKnowledgeGraphHash', () => {
    const { model } = compile({
      articleId: 'ag1',
      compiledAt: FIXED_AT,
      source: {
        kind: 'plain',
        text: '# Primary Intent\n\nShort.',
      },
    });
    const ag = buildActionGraph(model, { builtAt: BUILT_AT });
    expect(ag.schemaVersion).toBe(1);
    expect(ag.immutable).toBe(true);
    expect(ag.fromCcmVersion).toBe(model.version);
    expect(ag.contentHash).toBe(model.contentHash);
    expect(ag.fromKnowledgeGraphHash).toHaveLength(64);
    expect(ag.builtAt).toBe(BUILT_AT);
    expect(ag.actions.length).toBeGreaterThanOrEqual(1);
    expect(ag.actions.some((a) => a.dsl.op === 'FIX_STRUCTURE')).toBe(true);
    // short body → weak fact → strengthen; or uncovered intents
    const ops = ag.actions.map((a) => a.dsl.op);
    expect(
      ops.includes('STRENGTHEN_EVIDENCE') ||
        ops.includes('COVER_INTENT') ||
        ops.includes('ADD_FACT'),
    ).toBe(true);
  });

  it('covered intent with evidence does not COVER_INTENT', () => {
    const { model } = compile({
      articleId: 'ag2',
      compiledAt: FIXED_AT,
      source: {
        kind: 'plain',
        text: '# Wojna hybrydowa\n\nRosja użyła środków w 2014 roku na Krymie.',
      },
    });
    const ag = buildActionGraph(model, { builtAt: BUILT_AT });
    expect(ag.actions.some((a) => a.dsl.op === 'COVER_INTENT')).toBe(false);
    expect(ag.actions.some((a) => a.dsl.op === 'ADD_FACT')).toBe(false);
  });
});
