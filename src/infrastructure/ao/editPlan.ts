import type { EditCandidate } from '@/src/core/domain/optimize/editCandidate';
import type { ArticleIntentProfile } from '@/src/core/domain/optimize/intentProfile';
import {
  DEFAULT_EDIT_BUDGET,
  budgetForAction,
  type EditBudget,
} from '@/src/core/domain/optimize/editBudget';
import type { CompetitorSynthesis } from '@/src/infrastructure/wie/competitorSynthesis';
import { formatCompetitorSynthesisForPrompt } from '@/src/infrastructure/wie/competitorSynthesis';
import type { ReaderBrief } from '@/src/core/domain/wie/readerBrief';
import { formatReaderBriefForPrompt } from '@/src/core/domain/wie/readerBrief';
import type { PolicyBundle } from '@/src/infrastructure/wie/policyResolver';
import { formatPolicyBundleForPrompt } from '@/src/infrastructure/wie/policyResolver';
import type { NarrativePlan } from '@/src/infrastructure/wie/narrativePlanner';
import { formatNarrativePlanForPrompt } from '@/src/infrastructure/wie/narrativePlanner';
import { formatBoundedCoverageForPrompt } from '@/src/infrastructure/wie/writerContext';

export type PrecisionAction =
  | 'expand_existing_paragraph'
  | 'expand_section'
  | 'rewrite_section'
  | 'add_subsection'
  | 'add_missing_section'
  | 'improve_direct_answer'
  | 'add_facts'
  | 'insert_sentence'
  | 'enrich_heading'
  | 'add_faq'
  | 'skip';

export type PrecisionPlanStep = {
  id: string;
  sectionId: string;
  candidateId: string;
  gapId?: string;
  action: PrecisionAction;
  targetGap: { type: string; claimOrQuestion: string };
  reason?: string;
  expectedOutcomeId?: string;
  insertionPoint?: { paragraphIndex: number };
  maxNewWords: number;
  maxChangeRatio: number;
  allowedChanges: string[];
  forbiddenChanges: string[];
  budget: EditBudget;
};

export type PrecisionEditPlan = {
  steps: PrecisionPlanStep[];
  strategy: 'precision';
};

const DEFAULT_FORBIDDEN = [
  'new_topic',
  'commercial_services',
  'rewrite_unrelated_text',
] as const;

function actionForCandidate(c: EditCandidate): PrecisionAction {
  if (c.suggestedAction) {
    const a = c.suggestedAction as PrecisionAction;
    if (
      a === 'expand_section' || a === 'rewrite_section' || a === 'add_subsection'
      || a === 'add_missing_section' || a === 'improve_direct_answer' || a === 'add_facts'
      || a === 'insert_sentence' || a === 'add_faq' || a === 'enrich_heading'
      || a === 'expand_existing_paragraph'
    ) {
      return a;
    }
  }
  switch (c.source) {
    case 'paa':
    case 'ai_coverage':
    case 'visibility':
      return 'improve_direct_answer';
    case 'seo_term':
    case 'entity':
      return 'insert_sentence';
    case 'section_quality':
      return 'expand_section';
    default:
      return 'expand_existing_paragraph';
  }
}

export type BuildEditPlanInput = {
  candidates: EditCandidate[];
  profile: ArticleIntentProfile;
  defaultSectionId: string;
  maxSteps?: number;
  baseBudget?: EditBudget;
};

/** Map EditCandidate → bounded PlanStep. */
export function buildPrecisionEditPlan(input: BuildEditPlanInput): PrecisionEditPlan {
  const maxSteps = input.maxSteps ?? 8;
  const base = input.baseBudget ?? DEFAULT_EDIT_BUDGET;
  const steps: PrecisionPlanStep[] = [];

  for (const c of input.candidates) {
    if (steps.length >= maxSteps) break;
    const action = actionForCandidate(c);
    if (c.intentFit < 0.45) continue;

    const budget = budgetForAction(action, base);
    const isFaq = action === 'add_faq';
    const allowH = budget.allowNewHeading;

    steps.push({
      id: `step-${c.id}`,
      sectionId: c.targetSectionId || input.defaultSectionId,
      candidateId: c.id,
      gapId: c.gapId,
      action,
      targetGap: { type: c.source, claimOrQuestion: c.targetGap },
      reason: c.reason,
      expectedOutcomeId: c.expectedOutcome.id,
      insertionPoint: isFaq ? undefined : { paragraphIndex: 0 },
      maxNewWords: budget.maxNewWords,
      maxChangeRatio: budget.maxChangeRatio,
      allowedChanges: isFaq
        ? ['add_faq_item']
        : allowH
          ? ['expand_section', 'rewrite_section', 'add_facts', 'new_h3']
          : ['insert_sentence', 'expand_existing_paragraph', 'add_facts'],
      forbiddenChanges: allowH
        ? ['new_topic', 'commercial_services']
        : [...DEFAULT_FORBIDDEN, 'new_h2'],
      budget,
    });
  }

  return { steps, strategy: 'precision' };
}

/** WHAT / WHY / WHERE / HOW — never "improve this section". */
export function buildPrecisionStepPrompt(
  step: PrecisionPlanStep,
  sectionHtml: string,
  opts?: {
    synthesis?: CompetitorSynthesis | null;
    readerBrief?: ReaderBrief | null;
    policy?: PolicyBundle | null;
    narrative?: NarrativePlan | null;
    /** Extra hint for A/B variant B */
    variantHint?: string;
    /** Missing/underused NLP terms — a section rewrite weaves the ones that fit, closing
     *  several term gaps in one edit (how Surfer's AO lifts SEO) instead of one per step. */
    missingTerms?: readonly string[];
  },
): string {
  // A section-scope rewrite can carry SEO terms; a one-sentence insert or FAQ cannot.
  const WEAVE_ACTIONS = new Set([
    'rewrite_section', 'expand_section', 'expand_existing_paragraph',
    'add_missing_section', 'add_facts', 'improve_direct_answer',
  ]);
  const weaveTerms = (opts?.missingTerms ?? []).filter(Boolean).slice(0, 15);
  const weaveBlock = WEAVE_ACTIONS.has(step.action) && weaveTerms.length
    ? [
      'SEO TERMS — weave the ones that fit THIS section topic, as exact phrases, naturally',
      '(no keyword stuffing; skip any that do not belong here — do not force all of them):',
      weaveTerms.map((t) => `- ${t}`).join('\n'),
    ].join('\n')
    : '';

  const how =
    step.action === 'add_faq'
      ? 'Add concise FAQ Q&A only for unanswered questions.'
      : step.action === 'rewrite_section'
        ? 'Rewrite this section to fully satisfy the assigned objective. You may use lists/H3 if needed. Do not pad to a word count.'
        : step.action === 'expand_section' || step.action === 'expand_existing_paragraph'
          ? 'Expand only as needed to satisfy the objective. Do not pad to a word count.'
          : step.action === 'add_missing_section'
            // ONLY the new section. The runtime appends it after the anchor
            // (see runPrecisionOptimizeV4) — asking the model to echo the anchor back
            // made it merge the topic into that section instead, so the step was
            // accepted and the article still had the same number of H2s.
            ? `Write ONLY a brand new section — nothing else, do not repeat the section `
              + `you were shown. Start with <h2>${step.targetGap.claimOrQuestion}</h2>, then `
              + `2-4 short paragraphs (a list where it genuinely helps). `
              + `Let the heading set the length: one promising a quick or short answer gets `
              + `a few sentences, never the longest block on the page.`
          : step.action === 'improve_direct_answer'
              ? 'Add or strengthen a clear direct answer to the question/gap.'
              : step.action === 'add_facts'
                ? 'Add supporting facts/entities relevant to the gap.'
                : step.action === 'insert_sentence'
                  ? 'Insert one natural sentence into an existing paragraph.'
                  : 'Apply a targeted edit for the gap only.';

  const synthBlock = formatCompetitorSynthesisForPrompt(opts?.synthesis);
  const readerBlock = formatReaderBriefForPrompt(opts?.readerBrief);
  const policyBlock = formatPolicyBundleForPrompt(opts?.policy);
  const narrativeBlock = formatNarrativePlanForPrompt(opts?.narrative);
  const coverageBlock = formatBoundedCoverageForPrompt(opts?.synthesis);
  const voiceLines = policyBlock
    ? ''
    : [
      'VOICE:',
      '- Prefer problem-first / reader-addressed openings when synthesis says so; avoid dictionary-lead.',
      '- Include at least one concrete example when expanding a practical section.',
      '- Use expert cues where natural (e.g. "w praktyce", "najczęściej") — no fake credentials.',
      '- Prefer depth on critical synthesis items; do not pad FAQ or type-lists only for score.',
    ].join('\n');

  const openingValue = opts?.policy?.decisions.find((d) => d.id === 'opening')?.value;
  const hardOpening = openingValue === 'problem_first'
    ? [
      'HARD OPENING POLICY (must obey):',
      '- opening:problem_first — first paragraph MUST start with reader problem/stakes/emotion.',
      '- FORBIDDEN first sentence patterns: “X to…”, “X jest…”, “Definicja…”, dictionary leads.',
      '- If you explain what X is, do it AFTER the problem hook — never as the lead.',
    ].join('\n')
    : '';

  return [
    'You are a precision content editor. Execute ONLY the assigned objective.',
    `WHAT: ${step.targetGap.claimOrQuestion}`,
    `WHY: ${step.reason || step.targetGap.type}`,
    `WHERE: section (preserve unrelated content)`,
    `HOW: ${how}`,
    `ACTION: ${step.action}`,
    `MAX NEW WORDS (ceiling, not target): ${step.maxNewWords}`,
    `FORBIDDEN: ${step.forbiddenChanges.join(', ')}`,
    readerBlock,
    policyBlock,
    hardOpening,
    narrativeBlock,
    synthBlock,
    coverageBlock,
    weaveBlock,
    voiceLines,
    opts?.variantHint || '',
    'Improve the assigned objective without removing or weakening already-correct high-value content unless replacement is required for correctness.',
    'Return the FULL updated section HTML only.',
    '',
    'SECTION HTML:',
    sectionHtml,
  ].filter((line) => line !== '').join('\n');
}
