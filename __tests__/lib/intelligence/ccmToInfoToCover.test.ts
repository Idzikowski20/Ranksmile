import { readFileSync } from 'fs';
import { join } from 'path';
import { compile } from '../../../lib/compiler/compile';
import {
  buildInfoToCoverFromCcm,
  preferCcmInfoToCover,
} from '../../../lib/intelligence/ccmToInfoToCover';
import { projectArticleIntelligence } from '../../../lib/intelligence/runtimeApi';

const FIXED_AT = '2026-08-03T16:00:00.000Z';
const FIXTURE = readFileSync(
  join(__dirname, '../../fixtures/cias-001-hybrid-war.md'),
  'utf8',
);

describe('ccmToInfoToCover (OQ-8)', () => {
  it('maps CCM facts/intents into Info to cover shape', () => {
    const { model } = compile({
      articleId: 'cias-itc',
      compiledAt: FIXED_AT,
      source: { kind: 'plain', text: FIXTURE },
    });
    const itc = buildInfoToCoverFromCcm(model);
    expect(itc.source).toBe('ccm');
    expect(itc.intent.length).toBeGreaterThan(0);
    const allFacts = itc.topics.flatMap((t) => t.facts);
    expect(allFacts.length).toBeGreaterThan(0);
    expect(allFacts.some((f) => /Krym|2014|hybryd/i.test(f.text))).toBe(true);
    expect(preferCcmInfoToCover(model)).not.toBeNull();
  });

  it('ArticleIntelligenceView includes infoToCover', () => {
    const { model } = compile({
      articleId: 'cias-view',
      compiledAt: FIXED_AT,
      source: { kind: 'plain', text: FIXTURE },
    });
    const view = projectArticleIntelligence(model);
    expect(view.infoToCover.topics.length).toBeGreaterThan(0);
    expect(view.infoToCover.source).toBe('ccm');
  });
});
