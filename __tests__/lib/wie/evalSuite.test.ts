import {
  computeWritingIntelligence,
  scale10to100,
  patternUsageScore,
  coverageScoreFromSnapshot,
} from '../../../lib/wie/eval/scorecard';
import {
  scoreDocFeatures,
  buildCompetitorBenchmark,
  formatBenchmarkMarkdown,
} from '../../../lib/wie/eval/competitorBenchmark';
import {
  parseEditorialJudgeResult,
  formatEditorialReviewMarkdown,
  buildEditorialJudgeUserPrompt,
} from '../../../lib/wie/eval/editorialJudge';
import {
  buildTechnicalMarkdown,
  buildEditorialMarkdown,
  buildVerdictJson,
} from '../../../lib/wie/eval/reports';
import { buildTrendsMarkdown, type HistoryEntry } from '../../../lib/wie/eval/history';
import { reconcileBeatsTop5, weightedBeatsFromBenchmark, formatBeatsBreakdown } from '../../../lib/wie/eval/verdictAlign';
import { evaluatePublishGate, scoreRootIntentCoverage } from '../../../lib/wie/eval/publishGate';
import {
  evaluatePolicyCompliance,
  detectOpeningStyle,
} from '../../../lib/wie/eval/policyCompliance';

describe('WIE eval scorecard', () => {
  it('weights Writing Intelligence composite', () => {
    const r = computeWritingIntelligence({
      readerExperience: 80,
      narrative: 90,
      expertVoice: 70,
      informationGain: 60,
      seo: 100,
      coverage: 50,
      eeat: 40,
      patternUsage: 20,
    });
    // 0.2*80 + 0.15*90 + 0.15*70 + 0.15*60 + 0.1*100 + 0.1*50 + 0.1*40 + 0.05*20
    // = 16+13.5+10.5+9+10+5+4+1 = 69
    expect(r.writingIntelligence).toBeCloseTo(69, 0);
    expect(scale10to100(8)).toBe(80);
    expect(patternUsageScore({ patternIdsUsed: ['a', 'b'] })).toBeGreaterThan(40);
    expect(coverageScoreFromSnapshot({ total: 10, covered: 5 })).toBe(50);
  });
});

describe('WIE eval benchmark', () => {
  it('scores AO vs Top and picks winners', () => {
    const ao = `<h1>Co robić</h1><p>${'słowo '.repeat(40)} Padłeś ofiarą? W praktyce nie płać. Na przykład Messenger. Skontaktuj się z nami.</p><h2>A</h2><h2>B</h2><h2>C</h2>`;
    const top = {
      label: 'Top1',
      plain: 'Definicja szantażu. Słownik. ' + 'x '.repeat(50),
    };
    const b = buildCompetitorBenchmark({
      aoHtml: ao,
      competitors: [top],
    });
    expect(b.rows.length).toBe(2);
    expect(b.winners.opening).toBeTruthy();
    expect(formatBenchmarkMarkdown(b)).toContain('Comparison');
    const f = scoreDocFeatures({ label: 'AO', html: ao });
    expect(f.opening).toBeGreaterThanOrEqual(6);
  });

  it('picks argmax winner (Top2 8 beats Top1 4)', () => {
    const b = buildCompetitorBenchmark({
      aoHtml: '<p>Definicja. Słownik pojęcia.</p>',
      competitors: [
        { label: 'Top1', plain: 'You should know. ' + 'x '.repeat(20) },
        { label: 'Top2', plain: 'Padłeś ofiarą? Co robić teraz. Nie jesteś sam.' },
      ],
    });
    expect(b.rows.find((r) => r.label === 'Top2')!.scores.opening)
      .toBeGreaterThan(b.rows.find((r) => r.label === 'Top1')!.scores.opening);
    expect(b.winners.opening).toBe('Top2');
  });
});

describe('WIE eval verdict align + publish gate', () => {
  it('reconciles split benchmark as ties not wins', () => {
    const b = buildCompetitorBenchmark({
      aoHtml: `<h1>Co robić</h1><p>${'słowo '.repeat(40)} Padłeś ofiarą? W praktyce. Na przykład Messenger. Skontaktuj się.</p><h2>A</h2><h2>B</h2><h2>C</h2>`,
      competitors: [
        { label: 'Top1', plain: 'Padłeś ofiarą szantażu? Co robić. Nie jesteś sam.' },
      ],
    });
    // Force split: opening to Top1 if AO lost opening
    if (b.winners.opening !== 'AO') {
      expect(reconcileBeatsTop5({ benchmark: b, judgeOverall: 'wins' })).toBe('ties');
    } else {
      expect(['wins', 'ties']).toContain(reconcileBeatsTop5({ benchmark: b, judgeOverall: 'wins' }));
    }
  });

  it('blocks publish on placeholder + Last Updated', () => {
    const g = evaluatePublishGate(
      '<p>Szantaż to przestępstwo.</p><p>Editor: dodaj link</p><p>Last Updated: 2024</p>',
    );
    expect(g.decision).toBe('NOT READY');
    expect(g.blockers.some((b) => b.id === 'placeholder')).toBe(true);
    const ri = scoreRootIntentCoverage('<p>Co robić: 1. Nie płać. 2. Zachowaj dowody. 3. Zgłoś na policję.</p>');
    expect(ri.score).toBeGreaterThanOrEqual(7);
  });

  it('detects policy_first vs definition_first violation', () => {
    expect(detectOpeningStyle('<p>Szantaż to zmuszanie kogoś do zachowania.</p>')).toBe('definition_first');
    expect(detectOpeningStyle('<p>Padłeś ofiarą? Nie wiesz co robić. Oto plan.</p>')).toBe('problem_first');
    const c = evaluatePolicyCompliance({
      html: '<p>Szantaż to przestępstwo. Na przykład Messenger.</p>',
      explainability: [{
        decision: 'opening:problem_first',
        confidence: 0.92,
        effectiveness: 0.8,
        source_layer: 'industry',
        matched_conditions: {},
        reason: 'test',
        dna_version: 1,
      }, {
        decision: 'examples_min:1',
        confidence: 0.9,
        effectiveness: 0.7,
        source_layer: 'global',
        matched_conditions: {},
        reason: 'test',
        dna_version: 1,
      }, {
        decision: 'expert_voice:use_markers',
        confidence: 0.85,
        effectiveness: 0.7,
        source_layer: 'industry',
        matched_conditions: {},
        reason: 'test',
        dna_version: 1,
      }],
    });
    const opening = c.rows.find((r) => r.rule === 'Opening');
    expect(opening?.status).toBe('failed');
    expect(opening?.observed).toBe('definition_first');
    expect(c.has_violations).toBe(true);
  });

  it('explains weighted ties when opening lost', () => {
    const b = buildCompetitorBenchmark({
      aoHtml: `<h1>X</h1><p>${'słowo '.repeat(40)} W praktyce. Na przykład Messenger. Skontaktuj się.</p><h2>A</h2><h2>B</h2><h2>C</h2>`,
      competitors: [
        { label: 'Top2', plain: 'Padłeś ofiarą? Co robić. Nie jesteś sam.' },
      ],
    });
    const w = weightedBeatsFromBenchmark(b);
    expect(formatBeatsBreakdown(b)).toContain('Weighted result');
    if (b.winners.opening !== 'AO') {
      expect(w.overall).toBe('ties');
      expect(w.ratio).toBeLessThan(0.85);
    }
  });
});

describe('WIE eval editorial judge parse/render', () => {
  it('parses LLM JSON and renders code review', () => {
    const r = parseEditorialJudgeResult({
      categories: {
        narrative: { score: 9, pros: ['Problem first'], cons: ['Thin examples'], confidence: 0.9 },
        reader_experience: { score: 8, pros: ['Direct'], cons: [] },
        expert_voice: { score: 7, pros: [], cons: ['No practice'] },
        information_gain: { score: 5, pros: ['Explains'], cons: ['Nothing new'] },
        trust: { score: 6, pros: [], cons: [] },
        examples: { score: 4, pros: [], cons: ['Too few'] },
      },
      weaknesses: ['FAQ padding'],
      recommended_rewrites: ['Add Messenger case in section 2'],
      recommended_actions: [{
        section: 'Lead',
        action: 'Replace with problem-first scene',
        reason: 'Encyclopedic opening',
        expected_gain: '+Reader +Narrative',
      }],
      vs_top5: { better: ['narrative'], worse: ['opening'], overall: 'wins' },
      lead_encourages: 8,
      sounds_expert: 7,
      answers_intent: 9,
      better_than_top5: 6,
      root_intent_coverage: 7,
    });
    expect(r.categories.narrative.score).toBe(9);
    expect(r.vs_top5.overall).toBe('ties'); // softened: worse includes opening
    expect(r.recommended_actions[0].section).toBe('Lead');
    expect(r.weakness_items[0].severity).toBeTruthy();
    const md = formatEditorialReviewMarkdown(r);
    expect(md).toContain('✓ Problem first');
    expect(md).toContain('✗ Thin examples');
    expect(md).toContain('Root Intent Coverage');
    expect(buildEditorialJudgeUserPrompt({
      keyword: 'test',
      articleExcerpt: 'hello',
    })).toContain('Keyword: test');
  });
});

describe('WIE eval reports + history', () => {
  it('builds technical + editorial + verdict', () => {
    const scorecard = computeWritingIntelligence({
      readerExperience: 80,
      narrative: 90,
      expertVoice: 70,
      informationGain: 50,
      seo: 72,
      coverage: 60,
      eeat: 55,
      patternUsage: 40,
    });
    const judge = {
      status: 'ok' as const,
      tokens: 10,
      result: parseEditorialJudgeResult({
        categories: {
          narrative: { score: 9, pros: ['ok'], cons: [] },
          reader_experience: { score: 8, pros: [], cons: [] },
          expert_voice: { score: 7, pros: [], cons: [] },
          information_gain: { score: 5, pros: [], cons: ['thin'] },
          trust: { score: 6, pros: [], cons: [] },
          examples: { score: 4, pros: [], cons: [] },
        },
        weaknesses: [],
        recommended_rewrites: ['Add example'],
        vs_top5: { better: [], worse: ['examples'], overall: 'loses' },
        lead_encourages: 8,
        sounds_expert: 7,
        answers_intent: 9,
        better_than_top5: 4,
      }),
    };
    const tech = buildTechnicalMarkdown({
      runId: 't1',
      keyword: 'kw',
      timings: { ao: 12 },
      scoresBefore: { seo: 60, ai: 50, content: 55 },
      scoresAfter: { seo: 72, ai: 65, content: 68 },
      termsCount: 20,
      competitorsCount: 5,
      coverageTotal: 10,
      coverageCovered: 6,
      pipelineOk: true,
      errors: [],
      logs: ['ok'],
    });
    expect(tech).toContain('Pipeline: OK');
    const ed = buildEditorialMarkdown({
      runId: 't1',
      keyword: 'kw',
      scorecard,
      judge,
      benchmark: null,
      explainability: [{
        decision: 'opening:problem_first',
        confidence: 0.91,
        effectiveness: 0.8,
        source_layer: 'industry',
        matched_conditions: { intent: 'informational', industry: 'Legal', emotion: 'high' },
        reason: 'test',
        dna_version: 2,
        principle_id: 'answer_user_problem_first',
      }],
      pipelineOk: true,
      articleHtml: '<h1>Szantaż</h1><p>Treść.</p>',
    });
    expect(ed).toContain('Writing Intelligence');
    expect(ed).toContain('Explainability');
    expect(ed).toContain('Full article HTML');
    expect(ed).toContain('<h1>Szantaż</h1>');
    const v = buildVerdictJson({ scorecard, pipelineOk: true, judge, benchmark: null });
    expect(v.beats_top5).toBe('loses');
  });

  it('detects WI regression in trends', () => {
    const history: HistoryEntry[] = [
      {
        runId: 'a', at: '2026-01-01T00:00:00Z', keyword: 'k', writing_intelligence: 80,
        seo: 70, ai: 60, beats_top5: 'wins',
      },
      {
        runId: 'b', at: '2026-01-02T00:00:00Z', keyword: 'k', writing_intelligence: 70,
        seo: 70, ai: 60, beats_top5: 'loses',
      },
    ];
    const t = buildTrendsMarkdown(history, { keyword: 'k' });
    expect(t.regressions.length).toBeGreaterThanOrEqual(1);
    expect(t.markdown).toContain('WI sparkline');
  });
});
