import {
  bumpDnaVersion,
  listDnaVersions,
  readPatternStore,
  rollbackDnaVersion,
  writePatternStore,
} from '../../../lib/wie/patternStore';
import { __evolutionSignals } from '../../../lib/wie/evolutionLoop';
import type { CompetitorSynthesis } from '../../../lib/wie/competitorSynthesis';

describe('WIE DNA rollback', () => {
  it('snapshots on bump and restores prior version', async () => {
    const markerId = `rollback_marker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const before = await readPatternStore();
    before.patterns.push({
      id: markerId,
      pattern: 'Rollback marker pattern unique',
      principle_id: 'concrete_over_abstract',
      reason: 'test marker',
      conditions: {},
      layer: 'brand',
      weight: 0.5,
      confidence: 0.5,
      effectiveness: { used: 0, success_rate: 0.5 },
      frequency: 1,
      evidence: 1,
      source: 'brand:test.rollback',
      last_seen: new Date().toISOString().slice(0, 10),
      dna_version: before.dna_version,
    });
    await writePatternStore(before);
    const written = await readPatternStore();
    expect(written.patterns.some((p) => p.id === markerId)).toBe(true);

    const afterBump = await bumpDnaVersion(`rollback_unit_test_${markerId}`);
    expect(afterBump.dna_version).toBe(written.dna_version + 1);
    const targetVersion = afterBump.dna_version - 1;

    const live = await readPatternStore();
    live.patterns = live.patterns.filter((p) => p.id !== markerId);
    await writePatternStore(live);
    expect((await readPatternStore()).patterns.some((p) => p.id === markerId)).toBe(false);

    const versions = await listDnaVersions();
    expect(versions.versions.some((v) => v.version === targetVersion)).toBe(true);

    const restored = await rollbackDnaVersion(targetVersion);
    expect(restored.dna_version).toBe(targetVersion);
    expect(restored.patterns.some((p) => p.id === markerId)).toBe(true);
  });
});

describe('WIE evolution signals', () => {
  const base: CompetitorSynthesis = {
    critical: ['a', 'b', 'c'],
    important: [],
    optional: [],
    opening_style: { definition_first: true },
    section_patterns: ['faq', 'checklist kroków'],
    expert_claims: [],
    storytelling: ['case 1', 'case 2'],
    examples: [],
    cta: {},
    faq: { q1: 'a', q2: 'b' },
    information_gain: [],
  };

  it('detects faq, checklist, story, aio signals', () => {
    expect(__evolutionSignals.hasFaqSignal(base)).toBe(true);
    expect(__evolutionSignals.hasChecklistSignal(base)).toBe(true);
    expect(__evolutionSignals.hasStorySignal(base)).toBe(true);
    expect(__evolutionSignals.hasAioStyleSignal(base)).toBe(true);
  });

  it('does not false-positive on empty synthesis shape', () => {
    const empty: CompetitorSynthesis = {
      critical: ['only one'],
      important: [],
      optional: [],
      opening_style: { problem_first: true },
      section_patterns: ['intro'],
      expert_claims: [],
      storytelling: [],
      examples: [],
      cta: {},
      faq: {},
      information_gain: [],
    };
    expect(__evolutionSignals.hasFaqSignal(empty)).toBe(false);
    expect(__evolutionSignals.hasChecklistSignal(empty)).toBe(false);
    expect(__evolutionSignals.hasStorySignal(empty)).toBe(false);
    expect(__evolutionSignals.hasAioStyleSignal(empty)).toBe(false);
  });
});
