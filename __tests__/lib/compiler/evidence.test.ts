import { compile } from '../../../lib/compiler/compile';
import { buildEvidenceForFacts } from '../../../lib/ccm/builders/evidenceBuilder';
import type { FactNode } from '../../../lib/ccm/types/graph';
import type { LexicalAst } from '../../../lib/ccm/types/ast';

const FIXED_AT = '2026-08-03T08:00:00.000Z';

describe('fact-evidence MVP', () => {
  it('compile emits supportedBy evidence for dated facts', () => {
    const { model } = compile({
      articleId: 'ev1',
      compiledAt: FIXED_AT,
      source: {
        kind: 'plain',
        text: '# Topic\n\nRosja użyła środków w 2014 roku.',
      },
    });
    const ev = model.knowledge.graph.nodes.filter((n) => n.kind === 'evidence_span');
    expect(ev.length).toBeGreaterThanOrEqual(1);
    expect(ev.some((e) => e.kind === 'evidence_span' && e.evidenceKind === 'date')).toBe(true);
    expect(model.knowledge.indexes.evidenceByFactId.size).toBeGreaterThanOrEqual(1);
    const fact = model.knowledge.graph.nodes.find((n) => n.kind === 'fact');
    expect(fact && fact.kind === 'fact' && fact.status).not.toBe('weak');
  });

  it('short fact without span → weak', () => {
    const fact: FactNode = {
      id: 'f1',
      kind: 'fact',
      statement: 'Hi',
      subject: '',
      predicate: 'states',
      object: '',
      entityIds: [],
      importance: 'optional',
      confidence: 0.45,
      status: 'covered',
      verification: 'asserted',
      sectionId: 'b1',
    };
    const ast: LexicalAst = {
      version: 1,
      blocks: [{ blockId: 'b1', type: 'paragraph', text: 'Hi' }],
    };
    const result = buildEvidenceForFacts([fact], ast);
    expect(result.weakFactIds).toEqual(['f1']);
    expect(result.evidence).toEqual([]);
  });
});
