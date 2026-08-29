import {
  enforceOpeningPolicy,
  heuristicProblemFirstInject,
  openingPolicyViolated,
  openingPolicyHardRules,
} from '@/src/infrastructure/wie/enforceOpeningPolicy';
import { detectOpeningStyle } from '@/src/infrastructure/wie/eval/policyCompliance';
import { evaluatePublishGate } from '@/src/infrastructure/wie/eval/publishGate';
import { wieJudgeHtml } from '@/src/infrastructure/wie/writer';

describe('WIE opening policy enforcement', () => {
  const defHtml = '<h1>Szantaż</h1><p>Szantaż to zmuszanie kogoś do określonego zachowania przez groźbę.</p><h2>Dalej</h2><p>Treść.</p>';

  it('detects violation for definition-first lead', () => {
    expect(detectOpeningStyle(defHtml)).toBe('definition_first');
    expect(openingPolicyViolated(defHtml, 'problem_first')).toBe(true);
    expect(openingPolicyViolated(defHtml, 'definition_first')).toBe(false);
  });

  it('heuristic never replaces an existing lead paragraph', async () => {
    // It used to swap the first <p> for the canned "Czujesz, że…" hook — destroying
    // the direct answer the AI score demands and opening every article identically.
    const fixed = heuristicProblemFirstInject(defHtml, 'szantaż');
    expect(fixed).toBe(defHtml);
  });

  it('heuristic adds the hook only when there is no lead at all', () => {
    const noLead = '<h1>Szantaż</h1><h2>Dalej</h2>';
    const fixed = heuristicProblemFirstInject(noLead, 'szantaż');
    expect(fixed).toContain('Czujesz');
  });

  it('an answer-style lead the detector cannot classify is not a violation', () => {
    const answerLead = '<h1>Szantaż</h1><p>Jestem szantażowany? Nie płać ani nie spełniaj żądań — zabezpiecz dowody i zgłoś sprawę.</p>';
    expect(openingPolicyViolated(answerLead, 'problem_first')).toBe(false);
  });

  it('enforceOpeningPolicy leaves a definition lead for the LLM path when no llm is given', async () => {
    const r = await enforceOpeningPolicy({
      html: defHtml,
      expectedOpening: 'problem_first',
      keyword: 'szantaż',
    });
    expect(r.attempted).toBe(true);
    // Nothing safe to do without the LLM: replacing the lead loses content.
    expect(r.html).toBe(defHtml);
    expect(r.violated).toBe(true);
  });

  it('enforceOpeningPolicy prefers LLM rewrite when provided', async () => {
    const r = await enforceOpeningPolicy({
      html: defHtml,
      expectedOpening: 'problem_first',
      keyword: 'szantaż',
      llmEdit: async () => ({
        html: '<h1>Szantaż</h1><p>Padłeś ofiarą szantażu? Nie wiesz co robić — zacznij od planu.</p><h2>Dalej</h2><p>Treść.</p>',
        tokens: 12,
      }),
    });
    expect(r.method).toBe('llm');
    expect(r.tokens).toBe(12);
    expect(r.violated).toBe(false);
    expect(r.after).toBe('problem_first');
  });

  it('publish gate flags opening_policy_violation as critical', () => {
    const g = evaluatePublishGate(defHtml, {
      explainability: [{
        decision: 'opening:problem_first',
        confidence: 0.9,
        effectiveness: 0.8,
        source_layer: 'industry',
        matched_conditions: {},
        reason: 'test',
        dna_version: 1,
      }],
    });
    expect(g.decision).toBe('NOT READY');
    expect(g.blockers.some((b) => b.id === 'opening_policy_violation')).toBe(true);
  });

  it('wieJudgeHtml fails on opening policy violation', () => {
    const j = wieJudgeHtml({
      html: defHtml,
      expectedOpening: 'problem_first',
      requireEeat: false,
    });
    expect(j.ok).toBe(false);
    expect(j.reasons).toContain('opening_policy_violation');
  });

  it('exposes hard rules text for prompts', () => {
    expect(openingPolicyHardRules('problem_first')).toMatch(/HARD OPENING/);
    expect(openingPolicyHardRules('definition_first')).toBe('');
  });
});
