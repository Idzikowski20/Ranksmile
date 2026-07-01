import type { Section } from './articleSections';
import type { Guideline } from './recommendationEngine';
import type { ArticleContext } from './articleContext';
import type { RoutedGuideline } from './optimizeGuidelineRouting';
import { assignGuidelinesToSections } from './optimizeGuidelineRouting';
import { countOccurrences } from './contentScore';

export type { RoutedGuideline } from './optimizeGuidelineRouting';

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
  const routed = assignGuidelinesToSections(input.guidelines, input.sections);

  const steps: PlanStep[] = input.sections.map((section) => {
    const rgs = routed.get(section.id) ?? [];
    const secText = plainText(section.html);
    const secTerms = sectionMissingTerms(secText, input.context);

    const base = { sectionId: section.id, index: section.index, headingText: section.headingText, html: section.html, guidelines: rgs, missingTerms: secTerms };

    if (rgs.length === 0 && secTerms.length === 0) {
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

  const { trimmed, ignoredLift } = trimToBudget(steps, input.budgetRemaining);
  const survivingNonSkip = steps.filter((s) => s.focus !== 'skip');
  const rationale = `${survivingNonSkip.length}/${steps.length} sections to optimize${trimmed ? ` (trimmed, ignored ${ignoredLift} lift)` : ''}`;
  return {
    steps,
    estimatedTokens: survivingNonSkip.reduce((sum, s) => sum + s.estimatedTokens, 0),
    trimmed, ignoredLift, rationale,
  };
}

function trimToBudget(steps: PlanStep[], budgetRemaining: number): { trimmed: boolean; ignoredLift: number } {
  const nonSkip = steps.filter((s) => s.focus !== 'skip');
  const total = nonSkip.reduce((sum, s) => sum + s.estimatedTokens, 0);
  if (total <= budgetRemaining) return { trimmed: false, ignoredLift: 0 };

  const ranked = [...nonSkip].sort((a, b) =>
    (b.expectedLift / Math.max(b.estimatedTokens, 1)) - (a.expectedLift / Math.max(a.estimatedTokens, 1)));
  const keep = new Set<string>();
  let running = 0;
  for (const s of ranked) {
    if (running + s.estimatedTokens <= budgetRemaining) { keep.add(s.sectionId); running += s.estimatedTokens; }
  }
  let ignoredLift = 0;
  for (const s of steps) {
    if (s.focus !== 'skip' && !keep.has(s.sectionId)) {
      ignoredLift += s.expectedLift;
      s.focus = 'skip'; s.systemPrompt = ''; s.estimatedTokens = 0; s.reason = 'Trimmed — budget';
    }
  }
  return { trimmed: true, ignoredLift };
}

const SHARED_RULES = `You are an expert SEO content editor making MINIMAL, surgical edits to ONE section of an HTML article.

RULES:
- Apply MINIMAL surgical edits — refine, do not rewrite
- Tighten weak sentences and remove AI-sounding filler ("It's worth noting that", "In today's world", "Furthermore", "In conclusion", "Delve into")
- Keep the SAME LANGUAGE as the input (auto-detect — do NOT translate)
- Preserve EVERY heading, <a> link, <img>, and list EXACTLY as written
- Do NOT remove or shorten existing sentences — only refine or expand
- Keep each paragraph between ~40 and ~80 words`;

const NEGATIVE_CONSTRAINTS = `NEGATIVE CONSTRAINTS — Do NOT: rewrite unrelated paragraphs, remove or alter existing links, remove tables/images/lists, duplicate or rename headings, touch other sections, translate the text, or add markdown code fences.`;

const OUTPUT_RULE = `OUTPUT: ONLY the section's raw HTML. No markdown code fences, no commentary.`;

function focusBlock(step: PlanStep): string {
  const bullets = step.guidelines.map((r) => `- ${r.guideline.title}: ${r.guideline.instruction}`).join('\n');
  switch (step.focus) {
    case 'seo-terms': {
      const list = step.missingTerms.map((t) => `"${t}"`).join(', ');
      return list ? `FOCUS — weave in these MISSING NLP terms VERBATIM where natural (exact form, no inflection/synonyms): ${list}` : '';
    }
    case 'ai-coverage':
      return `FOCUS — improve AI-search answer readiness. Apply these guidelines:\n${bullets}`;
    case 'expand':
      return `FOCUS — deepen this section; it is currently shallow. Apply:\n${bullets}`;
    case 'readability':
      return `FOCUS — improve readability only: tighten sentences, de-fluff, right-size paragraphs.`;
    default:
      return '';
  }
}

export function buildStepPrompt(step: PlanStep, context: ArticleContext): string {
  if (step.focus === 'skip') return '';
  const brand = context.voiceTone ? `\n\nMatch this brand voice: ${context.voiceTone}` : '';
  const block = focusBlock(step);
  return `${SHARED_RULES}\n\n${block}${brand}\n\n${NEGATIVE_CONSTRAINTS}\n\n${OUTPUT_RULE}`;
}
