import { readFileSync } from 'fs';
import { join } from 'path';
import { compile } from '../../../lib/compiler/compile';
import { isFactNode, isIntentNode } from '../../../lib/ccm/types/graph';
import { projectCoverage } from '../../../lib/projections/coverageView';

const FIXED_AT = '2026-08-03T10:00:00.000Z';
const FIXTURE_DIR = join(__dirname, '../../fixtures');

const CASES: ReadonlyArray<{ id: string; file: string; minIntents: number; minFacts: number }> = [
  { id: 'cias-002', file: 'cias-002-medical.md', minIntents: 3, minFacts: 3 },
  { id: 'cias-003', file: 'cias-003-news.md', minIntents: 3, minFacts: 3 },
  { id: 'cias-004', file: 'cias-004-product.md', minIntents: 3, minFacts: 3 },
  { id: 'cias-005', file: 'cias-005-howto.md', minIntents: 3, minFacts: 3 },
  { id: 'cias-006', file: 'cias-006-legal.md', minIntents: 3, minFacts: 3 },
  { id: 'cias-007', file: 'cias-007-travel.md', minIntents: 3, minFacts: 3 },
  { id: 'cias-008', file: 'cias-008-comparison.md', minIntents: 3, minFacts: 3 },
];

describe('CIAS-002…008 smoke fixtures', () => {
  it.each(CASES)('$id compiles with intents+facts', ({ id, file, minIntents, minFacts }) => {
    const text = readFileSync(join(FIXTURE_DIR, file), 'utf8');
    const { model } = compile({
      articleId: id,
      compiledAt: FIXED_AT,
      profile: 'generic',
      source: { kind: 'plain', text },
      ccmId: `ccm_${id}`,
    });

    const intents = model.knowledge.graph.nodes.filter(isIntentNode);
    const facts = model.knowledge.graph.nodes.filter(isFactNode);
    expect(intents.length).toBeGreaterThanOrEqual(minIntents);
    expect(facts.length).toBeGreaterThanOrEqual(minFacts);

    const cov = projectCoverage(model);
    expect(cov.totalFacts).toBe(facts.length);
    expect(cov.overall).toBeGreaterThan(0);
  });
});
