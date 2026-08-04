import {
  normalizeFactKey,
  parseSpoHeuristic,
  splitAtomicClaims,
} from '../../../lib/ccm/builders/factEngine';
import { compile } from '../../../lib/compiler/compile';
import { isFactNode } from '../../../lib/ccm/types/graph';

describe('factEngine MVP', () => {
  it('splits long paragraphs into sentences', () => {
    const parts = splitAtomicClaims(
      'Pierwsze zdanie kończy się tutaj. Drugie zdanie zaczyna się wielką literą. Trzecie też.',
    );
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it('parses annexed SPO with year', () => {
    const spo = parseSpoHeuristic('Rosja anektowała Krym w 2014 roku.');
    expect(spo).not.toBeNull();
    expect(spo?.subject.toLowerCase()).toContain('rosja');
    expect(spo?.predicate).toBe('annexed');
    expect(spo?.object.toLowerCase()).toContain('krym');
  });

  it('normalizeFactKey collapses quotes/case', () => {
    expect(normalizeFactKey('  „Rosja”  ')).toBe('rosja');
  });

  it('compile produces SPO subject on hybrid annex fact', () => {
    const { model } = compile({
      articleId: 'fe-mvp',
      compiledAt: '2026-08-03T10:00:00.000Z',
      source: {
        kind: 'plain',
        text: '# Tytuł\n\n## Przykłady\n\nRosja anektowała Krym w 2014 roku.\n',
      },
    });
    const facts = model.knowledge.graph.nodes.filter(isFactNode);
    const annex = facts.find((f) => /anektował/i.test(f.statement));
    expect(annex).toBeDefined();
    expect(annex?.predicate).toBe('annexed');
    expect(annex?.subject.length).toBeGreaterThan(0);
    expect(annex?.object.length).toBeGreaterThan(0);
  });
});
