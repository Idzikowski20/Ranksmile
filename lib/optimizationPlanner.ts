import type { Section } from './articleSections';
import type { Guideline } from './recommendationEngine';
import type { ArticleContext } from './articleContext';
import type { computeContentScoreBreakdown } from './contentScore';
import type { RoutedGuideline } from './optimizeGuidelineRouting';
import { assignGuidelinesToSections } from './optimizeGuidelineRouting';
import { countOccurrences } from './contentScore';

export type { RoutedGuideline } from './optimizeGuidelineRouting';
type ContentScoreBreakdown = ReturnType<typeof computeContentScoreBreakdown>;

export type StepFocus = 'seo-terms' | 'ai-coverage' | 'readability' | 'expand' | 'skip';

export interface PlanStep {
  sectionId: string;
  index: number;
  headingText: string;
  html: string;
  focus: StepFocus;
  systemPrompt: string;
  guidelines: RoutedGuideline[];
  missingTerms: string[];
  estimatedTokens: number;
  expectedLift: number;
  reason: string;
}

export interface Plan {
  steps: PlanStep[];
  estimatedTokens: number;
  trimmed: boolean;
  ignoredLift: number;
  rationale: string;
}

export interface PlanInput {
  sections: Section[];
  guidelines: Guideline[];
  breakdown: ContentScoreBreakdown;
  context: ArticleContext;
  budgetRemaining: number;
}

const PROMPT_CONSTANT = 500;   // system-prompt + user-wrapper overhead (~400-600)
const TOKENS_PER_WORD = 1.3;
const DECAY = [1, 0.7, 0.5, 0.3, 0.2] as const;   // floor 0.1 beyond the array
const decayAt = (i: number): number => (i < DECAY.length ? DECAY[i] : 0.1);

export function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

export function wordCount(plain: string): number {
  return plain.split(/\s+/).filter(Boolean).length;
}

/** Body words * 1.3 + fixed prompt overhead (NOT html.length/4). */
export function estimateStepTokens(section: Section): number {
  return Math.round(wordCount(plainText(section.html)) * TOKENS_PER_WORD + PROMPT_CONSTANT);
}

/** Diminishing-returns aggregate: lifts sorted desc, each * DECAY[i], rounded. */
export function diminishingLift(liftsDesc: number[]): number {
  const sorted = [...liftsDesc].sort((a, b) => b - a);
  return Math.round(sorted.reduce((sum, lift, i) => sum + lift * decayAt(i), 0));
}

const SMALL_MISSING_POINTS = 2;   // a section under this missingPoints with nothing routed is "covered enough"

/** Per-section under-target NLP terms (per-section countOccurrences, mirrors optimizeSectionEdit.computeMissingTerms). */
function sectionMissingTerms(secText: string, ctx: ArticleContext): string[] {
  const terms = ctx.scoreData?.terms ?? [];
  return terms
    .filter((t) => countOccurrences(secText, t.term) < Math.max(1, Math.round(t.target_count * 0.7)))
    .map((t) => t.term);
}

function focusFor(rgs: RoutedGuideline[], secTerms: string[]): StepFocus {
  const top = rgs[0]?.guideline;
  if (top?.group === 'intent') return 'ai-coverage';
  if (top?.effort === 'Large') return 'expand';                        // needsExpansion -> Large (effortOf)
  if (top && (top.group === 'knowledge' || top.group === 'authority')) return 'ai-coverage';
  if (secTerms.length > 0) return 'seo-terms';
  return 'readability';
}

export function buildOptimizationPlan(input: PlanInput): Plan {
  const routed = assignGuidelinesToSections(input.guidelines, input.sections, { breakdown: input.breakdown });

  const steps: PlanStep[] = input.sections.map((section) => {
    const rgs = routed.get(section.id) ?? [];
    const secText = plainText(section.html);
    const secTerms = sectionMissingTerms(secText, input.context);
    const missPts = input.breakdown.slots.find((s) => s.key === section.id)?.missingPoints ?? 0;

    const base = { sectionId: section.id, index: section.index, headingText: section.headingText, html: section.html, guidelines: rgs, missingTerms: secTerms };

    if (rgs.length === 0 && secTerms.length === 0 && missPts <= SMALL_MISSING_POINTS) {
      return { ...base, focus: 'skip', systemPrompt: '', estimatedTokens: 0, expectedLift: 0, reason: 'Skipped — no uncovered guidelines' };
    }
    const focus = focusFor(rgs, secTerms);
    const expectedLift = diminishingLift(rgs.map((r) => r.guideline.projectedLift));
    const step: PlanStep = {
      ...base, focus, expectedLift,
      estimatedTokens: estimateStepTokens(section),
      systemPrompt: buildStepPrompt({ ...base, focus, expectedLift, estimatedTokens: 0, reason: '', systemPrompt: '' }, input.context),
      reason: rgs.length ? `Optimize: ${rgs.length} guidelines` : 'Optimize: under-target terms',
    };
    return step;
  });

  const nonSkip = steps.filter((s) => s.focus !== 'skip');
  const rationale = `${nonSkip.length}/${steps.length} sections to optimize`;
  return { steps, estimatedTokens: nonSkip.reduce((sum, s) => sum + s.estimatedTokens, 0), trimmed: false, ignoredLift: 0, rationale };
}

// Temporary stub — replaced by the real per-focus builder in Task 6.
function buildStepPrompt(_step: PlanStep, _context: ArticleContext): string { return 'STUB'; }
