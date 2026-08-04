import { judgeArticleQuality, QUALITY_DNA_THRESHOLD } from '../../../lib/wie/qualityJudge';
import { bumpDnaVersion, readPatternStore } from '../../../lib/wie/patternStore';
import { discoverAndAcceptPattern } from '../../../lib/wie/patternDiscovery';

describe('WIE qualityJudge', () => {
  it('fails thin stub below DNA threshold', () => {
    const r = judgeArticleQuality({
      html: '<h1>Hi</h1><p>Short text only.</p>',
    });
    expect(r.pass).toBe(false);
    expect(r.score).toBeLessThan(QUALITY_DNA_THRESHOLD);
  });

  it('passes rich expert article', () => {
    const paras = Array.from({ length: 8 }, (_, i) => {
      const n = 20 + (i % 5) * 30;
      return `<p>${'słowo '.repeat(n)}. ${i === 1 ? 'Na przykład Messenger.' : ''} ${i === 2 ? 'W praktyce nie płać.' : ''}</p>`;
    }).join('');
    const html = `<h1>Szantaż</h1><h2>Co robić</h2><h2>Kroki</h2>${paras}`;
    const r = judgeArticleQuality({ html });
    expect(r.signals.hasExamples).toBe(true);
    expect(r.signals.hasExpertMarkers).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });
});

describe('WIE brand DNA versioning', () => {
  it('bumpDnaVersion increments', async () => {
    const before = await readPatternStore();
    const after = await bumpDnaVersion('unit_test');
    expect(after.dna_version).toBe(before.dna_version + 1);
  });

  it('accepts brand-layer pattern without colliding industry seed', async () => {
    const r = await discoverAndAcceptPattern({
      pattern: 'Problem before definition',
      principle_id: 'answer_user_problem_first',
      reason: 'brand test',
      conditions: { industry: ['Legal'], emotion: ['high'] },
      layer: 'brand',
      industry: 'Legal',
      source: 'brand:example.test',
      evidence: 2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pattern.layer).toBe('brand');
      expect(r.pattern.source).toBe('brand:example.test');
    }
  });
});
