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
import { sectionGrowthAllowance, type ArticleWords } from '@/src/core/domain/optimize/lengthBudget';

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

/**
 * Everything one section still owes, delivered in a single edit — the way Surfer's
 * Auto-Optimize visits a section once with its terms, facts and heading term instead
 * of one model call per gap.
 */
export type SectionBundle = {
  /** Terms/entities to weave into existing sentences of this section. */
  terms: string[];
  /** Facts / answers to attach as clauses to the sentences they support. */
  facts: string[];
  /** Section-level objectives (depth, intent) stated as instructions. */
  objectives: string[];
  /** A term the SERP puts in headings — goes into this section's H2. */
  headingTerm?: string;
};

export type PrecisionPlanStep = {
  id: string;
  sectionId: string;
  candidateId: string;
  gapId?: string;
  /** Every gap a bundle step closes; resolved together when the step is accepted. */
  gapIds?: string[];
  bundle?: SectionBundle;
  /** The target section's heading — ids hash (index, heading), so an insertion earlier
   *  in the article changes every later id; the heading still finds the section. */
  sectionHeading?: string;
  /** Whole-article length the edit must respect (SERP target / max, current count). */
  articleWords?: ArticleWords;
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

function allowedChangesFor(isFaq: boolean, allowHeading: boolean): string[] {
  if (isFaq) return ['add_faq_item'];
  if (allowHeading) return ['expand_section', 'rewrite_section', 'add_facts', 'new_h3'];
  return ['insert_sentence', 'expand_existing_paragraph', 'add_facts'];
}

/** Map EditCandidate → bounded PlanStep. */
export function buildPrecisionEditPlan(input: BuildEditPlanInput): PrecisionEditPlan {
  const maxSteps = input.maxSteps ?? 8;
  const base = input.baseBudget ?? DEFAULT_EDIT_BUDGET;
  const steps: PrecisionPlanStep[] = [];

  for (const c of input.candidates.filter((x) => x.intentFit >= 0.45)) {
    if (steps.length >= maxSteps) break;
    const action = actionForCandidate(c);

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
      allowedChanges: allowedChangesFor(isFaq, allowH),
      forbiddenChanges: allowH
        ? ['new_topic', 'commercial_services']
        : [...DEFAULT_FORBIDDEN, 'new_h2'],
      budget,
    });
  }

  return { steps, strategy: 'precision' };
}

// Bundle size is what the model turns into length: uncapped bundles came back at
// +300–400 words and doubled sections. Surfer's runs weave ~25 terms over a whole
// article and add ~25–30 words per inserted item.
const BUNDLE_MAX_NEW_WORDS = 300;
const BUNDLE_MAX_PARAGRAPHS = 24;
const BUNDLE_MAX_TERMS = 6;
const BUNDLE_MAX_FACTS = 4;
const BUNDLE_MAX_OBJECTIVES = 2;
const BUNDLE_WORDS_PER_ITEM = 30;
/** Items a bundle may carry per word of allowance — with 89 words there is room for 3, not 12;
 *  asking for 12 produced +180 and a rejected edit. */
const ALLOWANCE_WORDS_PER_ITEM = 25;
const BUNDLE_MIN_ITEMS = 2;
/** The gate forgives what the prompt does not: models land a few words over a ceiling. */
const GATE_SLACK = 1.15;
/** Sentence-level weaving across a section rewrites more of it than one gap would. */
const BUNDLE_CHANGE_RATIO = 0.85;

/**
 * One step per section, carrying every candidate targeted at it. Sections without a
 * candidate get no step. Appending actions (add_missing_section) are not bundled — they
 * create a section rather than edit one.
 */
export function buildSectionBundleSteps(input: {
  candidates: EditCandidate[];
  sections: Array<{ id: string; index: number; headingText: string }>;
  baseBudget?: EditBudget;
  articleWords?: ArticleWords;
}): PrecisionPlanStep[] {
  const base = input.baseBudget ?? DEFAULT_EDIT_BUDGET;
  const bySection = new Map<string, EditCandidate[]>();
  const editable = input.candidates.filter(
    (c) => c.targetSectionId && c.suggestedAction !== 'add_missing_section' && c.intentFit >= 0.45,
  );
  for (const c of editable) {
    const sectionId = c.targetSectionId as string;
    const arr = bySection.get(sectionId) ?? [];
    arr.push(c);
    bySection.set(sectionId, arr);
  }

  // The article's length target, shared across the sections about to be edited.
  const allowance = input.articleWords
    ? sectionGrowthAllowance({ ...input.articleWords, sections: bySection.size })
    : Infinity;
  const itemCap = Number.isFinite(allowance)
    ? Math.max(BUNDLE_MIN_ITEMS, Math.floor(allowance / ALLOWANCE_WORDS_PER_ITEM))
    : Infinity;

  const steps: PrecisionPlanStep[] = [];
  const ordered = [...input.sections].sort((a, b) => a.index - b.index).filter((sec) => bySection.get(sec.id)?.length);
  for (const sec of ordered) {
    const group = bySection.get(sec.id) ?? [];

    const bundle: SectionBundle = { terms: [], facts: [], objectives: [] };
    const count = () => bundle.terms.length + bundle.facts.length + bundle.objectives.length + (bundle.headingTerm ? 1 : 0);
    // Only the gaps the model is actually shown get resolved on success; the overflow
    // stays open so the next pass can pick it up.
    const gapIds: string[] = [];
    for (const c of group) {
      if (count() >= itemCap) break;
      let taken = false;
      if (c.suggestedAction === 'enrich_heading' && !bundle.headingTerm) {
        bundle.headingTerm = c.phrase ?? c.targetGap;
        taken = true;
      } else if (c.source === 'seo_term' || c.source === 'entity') {
        if (bundle.terms.length < BUNDLE_MAX_TERMS) {
          bundle.terms.push(c.phrase ?? c.targetGap);
          taken = true;
        }
      } else if (c.source === 'ai_coverage' || c.source === 'paa' || c.source === 'visibility') {
        if (bundle.facts.length < BUNDLE_MAX_FACTS) {
          bundle.facts.push(c.targetGap);
          taken = true;
        }
      } else if (bundle.objectives.length < BUNDLE_MAX_OBJECTIVES) {
        bundle.objectives.push(c.targetGap);
        taken = true;
      }
      if (taken && c.gapId) gapIds.push(c.gapId);
    }

    const action: PrecisionAction = group.some((c) => c.suggestedAction === 'rewrite_section')
      ? 'rewrite_section'
      : 'expand_section';
    const budget = budgetForAction(action, base);
    const items = bundle.terms.length + bundle.facts.length + bundle.objectives.length + (bundle.headingTerm ? 1 : 0);
    const maxNewWords = Math.min(
      BUNDLE_MAX_NEW_WORDS,
      Math.max(budget.maxNewWords, BUNDLE_WORDS_PER_ITEM * items),
      Math.max(20, allowance),
    );
    // Weaving touches paragraphs all over the section; the word budget is the real
    // bound. A single-gap paragraph cap rejected bundles at 9, 12 and 14 paragraphs.
    const maxModifiedParagraphs = Math.max(budget.maxModifiedParagraphs, BUNDLE_MAX_PARAGRAPHS);
    // A bundle edits the section it was given. The strategy budget may allow new
    // headings for appending actions; here it let the model prepend an invented H2.
    const stepBudget: EditBudget = {
      ...budget,
      maxNewWords: Math.ceil(maxNewWords * GATE_SLACK),
      maxModifiedParagraphs,
      maxChangeRatio: Math.max(budget.maxChangeRatio, BUNDLE_CHANGE_RATIO),
      allowNewHeading: false,
    };

    steps.push({
      id: `bundle-${sec.id}`,
      sectionId: sec.id,
      candidateId: group[0].id,
      gapIds,
      bundle,
      sectionHeading: sec.headingText,
      articleWords: input.articleWords,
      action,
      targetGap: { type: 'section_bundle', claimOrQuestion: sec.headingText || 'Introduction' },
      reason: `${items} gap${items === 1 ? '' : 's'} in this section`,
      expectedOutcomeId: `section:bundle:${sec.id}`,
      insertionPoint: { paragraphIndex: 0 },
      maxNewWords,
      maxChangeRatio: stepBudget.maxChangeRatio,
      allowedChanges: ['insert_sentence', 'expand_existing_paragraph', 'add_facts', 'enrich_heading'],
      forbiddenChanges: [...DEFAULT_FORBIDDEN, 'new_h2'],
      budget: stepBudget,
    });
  }
  return steps;
}

/**
 * Second try for a bundle edit that overshot its budget. The model lands 2–40 words over
 * the ceiling with striking regularity; asking it to shorten its own edit is cheaper than
 * throwing the edit (and its woven terms and facts) away.
 */
export function buildTrimPrompt(opts: {
  step: PrecisionPlanStep;
  addedWords: number;
  editedHtml: string;
}): string {
  return [
    'Your previous edit of this section is over budget.',
    `It added ${opts.addedWords} words; the section may grow by at most ${opts.step.maxNewWords} words.`,
    'Shorten your edit to fit: keep the heading, keep every term and fact you wove in, cut filler and',
    'merge any paragraphs you added into the existing ones. Do not add anything new.',
    'Return the FULL updated section HTML only.',
    '',
    'SECTION HTML:',
    opts.editedHtml,
  ].join('\n');
}

function bundleBlock(bundle: SectionBundle): string {
  const lines: string[] = ['SECTION OBJECTIVES — close every item below inside THIS section only:'];
  if (bundle.headingTerm) {
    lines.push(`HEADING — rewrite the <h2> so it naturally contains "${bundle.headingTerm}" (keep its meaning, no second heading).`);
  }
  if (bundle.objectives.length) {
    lines.push('OBJECTIVES:', ...bundle.objectives.map((o) => `- ${o}`));
  }
  if (bundle.facts.length) {
    lines.push(
      'FACTS — attach each as a subordinate clause to the existing sentence it supports, '
      + 'or as one short sentence right after it. No new headings, no bullet dumps, no FAQ:',
      ...bundle.facts.map((f) => `- ${f}`),
    );
  }
  if (bundle.terms.length) {
    lines.push(
      'TERMS — weave each into an existing sentence or list item; inflect it to fit the grammar '
      + '(a declined form counts). Skip a term only when it truly does not belong here:',
      ...bundle.terms.map((t) => `- ${t}`),
    );
  }
  return lines.join('\n');
}

/** The HOW line of a step prompt. */
function howFor(step: PrecisionPlanStep): string {
  if (step.bundle) {
    return 'Weave every item into the existing sentences and list items of this section; do not add paragraphs '
      + 'unless a fact has no sentence to attach to. Keep the section length: it may grow by at most '
      + `${step.maxNewWords} words in total.`;
  }
  switch (step.action) {
    case 'add_faq':
      return 'Add concise FAQ Q&A only for unanswered questions.';
    case 'rewrite_section':
      return 'Rewrite this section to fully satisfy the assigned objective. You may use lists/H3 if needed. '
        + 'Do not pad to a word count.';
    case 'expand_section':
    case 'expand_existing_paragraph':
      return 'Expand only as needed to satisfy the objective. Do not pad to a word count.';
    case 'add_missing_section':
      // ONLY the new section. The runtime appends it after the anchor
      // (see runPrecisionOptimizeV4) — asking the model to echo the anchor back
      // made it merge the topic into that section instead, so the step was
      // accepted and the article still had the same number of H2s.
      return 'Write ONLY a brand new section — nothing else, do not repeat the section '
        + `you were shown. Start with <h2>${step.targetGap.claimOrQuestion}</h2>, then `
        + '2-4 short paragraphs (a list where it genuinely helps). '
        + 'Let the heading set the length: one promising a quick or short answer gets '
        + 'a few sentences, never the longest block on the page.';
    case 'improve_direct_answer':
      return 'Add or strengthen a clear direct answer to the question/gap.';
    case 'add_facts':
      return 'Add supporting facts/entities relevant to the gap.';
    case 'insert_sentence':
      return 'Insert one natural sentence into an existing paragraph.';
    default:
      return 'Apply a targeted edit for the gap only.';
  }
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
  const bundled = new Set(step.bundle?.terms ?? []);
  const weaveTerms = (opts?.missingTerms ?? []).filter((t) => t && !bundled.has(t)).slice(0, 15);
  // A bundle already names this section's terms; the global list on top of them read as
  // a term dump and doubled sections (270→517 words).
  const weaveBlock = !step.bundle && WEAVE_ACTIONS.has(step.action) && weaveTerms.length
    ? [
      'SEO TERMS — weave the ones that fit THIS section topic, as exact phrases, naturally',
      '(no keyword stuffing; skip any that do not belong here — do not force all of them):',
      weaveTerms.map((t) => `- ${t}`).join('\n'),
    ].join('\n')
    : '';

  const how = howFor(step);

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
    'WHERE: section (preserve unrelated content)',
    `HOW: ${how}`,
    `ACTION: ${step.action}`,
    `MAX NEW WORDS (ceiling, not target): ${step.maxNewWords}`,
    step.articleWords
      ? `ARTICLE LENGTH: the whole article targets ~${step.articleWords.target} words (SERP average; max ${step.articleWords.max}) `
        + `and has ${step.articleWords.current} now. Sections must stay in proportion — this one may grow by at most ${step.maxNewWords} words.`
      : '',
    `FORBIDDEN: ${step.forbiddenChanges.join(', ')}`,
    step.bundle ? bundleBlock(step.bundle) : '',
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
