import { compile } from '../../../lib/compiler/compile';
import { lex } from '../../../lib/compiler/lexer';
import { hashCompileSource } from '../../../lib/compiler/contentHash';
import { isEntityNode, isFactNode, isIntentNode } from '../../../lib/ccm/types/graph';

const FIXED_AT = '2026-08-03T00:00:00.000Z';

describe('compiler skeleton + builders (Etap 8)', () => {
  it('plain text → AST + heuristic KG (intent/fact/entity)', () => {
    const { model, traces } = compile({
      articleId: 'a1',
      compiledAt: FIXED_AT,
      source: {
        kind: 'plain',
        text: '# Wojna hybrydowa\n\nRosja użyła środków w 2014 roku.',
      },
    });

    expect(model.ast.blocks[0]?.type).toBe('heading');
    expect(model.ir.candidates.some((c) => c.kind === 'intent')).toBe(true);
    expect(model.ir.candidates.some((c) => c.kind === 'fact')).toBe(true);

    const intents = model.knowledge.graph.nodes.filter(isIntentNode);
    const facts = model.knowledge.graph.nodes.filter(isFactNode);
    const entities = model.knowledge.graph.nodes.filter(isEntityNode);
    expect(intents.length).toBeGreaterThanOrEqual(1);
    expect(intents[0]?.label).toBe('Wojna hybrydowa');
    expect(intents[0]?.primary).toBe(true);
    expect(facts.length).toBeGreaterThanOrEqual(1);
    expect(facts[0]?.statement).toContain('2014');
    expect(entities.some((e) => e.canonicalName === 'Rosja')).toBe(true);

    expect(model.knowledge.indexes.byId.size).toBe(model.knowledge.graph.nodes.length);
    expect(model.knowledge.graph.edges.some((e) => e.type === 'uses')).toBe(true);
    expect(model.knowledge.graph.edges.some((e) => e.type === 'supports')).toBe(true);
    expect(model.knowledge.graph.edges.some((e) => e.type === 'supportedBy')).toBe(true);
    expect(model.knowledge.graph.nodes.some((n) => n.kind === 'evidence_span')).toBe(true);
    expect(model.compiler.capabilities.ir).toBe(true);
    expect(model.compiler.capabilities.planner).toBe(true);
    expect(traces.map((t) => t.stageId)).toEqual([
      'entity',
      'fact',
      'evidence',
      'intent',
    ]);
  });

  it('same source → same contentHash and deterministicHash', () => {
    const opts = {
      articleId: 'a1',
      compiledAt: FIXED_AT,
      source: { kind: 'plain' as const, text: 'Same body.' },
    };
    const a = compile(opts);
    const b = compile(opts);
    expect(a.model.contentHash).toBe(b.model.contentHash);
    expect(a.model.compiler.deterministicHash).toBe(b.model.compiler.deterministicHash);
    expect(a.model.contentHash).toBe(hashCompileSource(opts.source));
  });

  it('tiptap doc → heading + paragraph blockIds', () => {
    const { model } = compile({
      articleId: 'a2',
      compiledAt: FIXED_AT,
      source: {
        kind: 'tiptap',
        doc: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'H2' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Para' }],
            },
          ],
        },
      },
    });
    expect(model.ast.blocks).toHaveLength(2);
    expect(model.knowledge.graph.nodes.some(isIntentNode)).toBe(true);
    expect(model.knowledge.graph.nodes.some(isFactNode)).toBe(true);
  });

  it('lex is deterministic for plain text', () => {
    const t1 = lex({ kind: 'plain', text: 'A\n\nB' });
    const t2 = lex({ kind: 'plain', text: 'A\n\nB' });
    expect(t1).toEqual(t2);
    expect(t1.map((t) => t.blockId)).toEqual(['b1', 'b2']);
  });

  it('empty source → empty KG', () => {
    const { model } = compile({
      articleId: 'empty',
      compiledAt: FIXED_AT,
      source: { kind: 'plain', text: '' },
    });
    expect(model.ast.blocks).toEqual([]);
    expect(model.knowledge.graph.nodes).toEqual([]);
  });
});
