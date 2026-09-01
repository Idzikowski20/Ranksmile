import { buildPrecisionStepPrompt, type PrecisionPlanStep } from '@/src/infrastructure/ao/editPlan';

function step(action: PrecisionPlanStep['action']): PrecisionPlanStep {
  return {
    id: 's1', sectionId: 'sec1', candidateId: 'c1', action,
    targetGap: { type: 'section_quality', claimOrQuestion: 'Objaśnij mechanizm' },
    maxNewWords: 120, maxChangeRatio: 0.6,
    allowedChanges: [], forbiddenChanges: [],
  };
}

const terms = ['szantaż emocjonalny w związku', 'poczucie winy', 'techniki manipulacji'];

describe('buildPrecisionStepPrompt — SEO term weaving', () => {
  it('injects missing terms into a section rewrite so one edit closes several gaps', () => {
    const prompt = buildPrecisionStepPrompt(step('rewrite_section'), '<p>x</p>', { missingTerms: terms });
    expect(prompt).toContain('SEO TERMS — weave');
    for (const t of terms) expect(prompt).toContain(t);
  });

  it('does NOT add the weave block to a one-sentence insert (already single-term)', () => {
    const prompt = buildPrecisionStepPrompt(step('insert_sentence'), '<p>x</p>', { missingTerms: terms });
    expect(prompt).not.toContain('SEO TERMS — weave');
  });

  it('no weave block when there are no missing terms', () => {
    const prompt = buildPrecisionStepPrompt(step('rewrite_section'), '<p>x</p>', { missingTerms: [] });
    expect(prompt).not.toContain('SEO TERMS — weave');
  });
});
