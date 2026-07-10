import type { Section } from './articleSections';
import type { Guideline } from './recommendationEngine';
import type { ArticleContext } from './articleContext';
import type { RoutedGuideline } from './optimizeGuidelineRouting';
import type { CoverageSnapshot } from './aiCoverage';
import { assignGuidelinesToSections } from './optimizeGuidelineRouting';
import { countOccurrences } from './contentScore';
import { selectOptimizeMode, type OptimizeMode, SEO_READY, AI_GAP } from './optimizeMode';
import type { OptimizePhase } from './optimizeRunPhase';

export type { RoutedGuideline } from './optimizeGuidelineRouting';

export type StepFocus = 'seo-terms' | 'ai-coverage' | 'readability' | 'expand' | 'skip';

export type EditMode = 'less' | 'normal' | 'expand';

export type { OptimizeMode } from './optimizeMode';

// --- benefit-threshold + takeover constants (tunable; 0..100 AI-score scale) ---
const LESS_MIN = 6;
const NORMAL_MIN = 12;
const SEO_HIGH = SEO_READY;
const AI_GAP_LEGACY = AI_GAP;
const INTENT_INTRO_MIN = 50;   // intent bucket score below which intro may expand
const TERM_WORTH_FLOOR = 1;    // OD-2 [RATIFIED]: a section with >=1 under-target term (when NOT in aiTakeover) is worth a LESS edit

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
  mode: EditMode;
  userInstruction?: string;
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
  seoScore: number;
  aiScore: number;
  phase?: OptimizePhase;
  mode?: OptimizeMode;
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

export function hasCriticalMiss(rgs: RoutedGuideline[]): boolean {
  return rgs.some((r) => r.guideline.importance === 'critical');
}

interface WorthInput {
  expectedLift: number;
  rgs: RoutedGuideline[];
  secTerms: string[];
  aiTakeover: boolean;
}

/** The "good enough" gate (RCA §1/§5). Skip a section whose predicted benefit is below LESS_MIN,
 *  unless it carries a critical coverage miss. Term-only sections (expectedLift 0) are worth a LESS
 *  edit when NOT in AI-takeover (OD-2 [RATIFIED]); AI-takeover suppresses the term path. */
export function worthEditing({ expectedLift, rgs, secTerms, aiTakeover }: WorthInput): boolean {
  if (hasCriticalMiss(rgs)) return true;
  if (expectedLift >= LESS_MIN) return true;
  // Term-only deficit: >=1 under-target term is worth a minimal LESS weave, unless AI-takeover drops it.
  if (!aiTakeover && secTerms.length >= TERM_WORTH_FLOOR) return true;
  return false;
}

export function introMayExpand(snapshot: CoverageSnapshot): boolean {
  const intentScore = snapshot.buckets.find((b) => b.key === 'intent')?.score ?? 0;
  return intentScore < INTENT_INTRO_MIN || snapshot.answersMainQuestionEarly === false;
}

interface ModeInput {
  section: Section;
  expectedLift: number;
  rgs: RoutedGuideline[];
  snapshot: CoverageSnapshot;
  aiTakeover: boolean;
}

/** Edit-intensity selector. Assumes worthEditing already passed (else the caller skips). */
export function selectMode({ section, expectedLift, rgs, snapshot }: ModeInput): EditMode {
  const expandEligible = rgs[0]?.guideline.effort === 'Large' || hasCriticalMiss(rgs);
  // Intro protection (pillar 4): LESS-only + EXPAND blocked unless intent is genuinely weak.
  if (section.index === 0 && !introMayExpand(snapshot)) return 'less';
  if (expandEligible) return 'expand';
  if (expectedLift > NORMAL_MIN) return 'normal';
  return 'less';
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
  const phase = input.phase ?? 'first_run';
  const mode = input.mode ?? selectOptimizeMode(input.seoScore, input.aiScore, phase);
  const followUp = phase === 'follow_up';
  const aiTakeover = followUp || mode === 'ai-only' || mode === 'minimal'
    || (input.seoScore >= SEO_HIGH && (input.seoScore - input.aiScore) > AI_GAP_LEGACY);
  const seoOnly = mode === 'seo-first';
  const snapshot = input.context.coverage;

  const steps: PlanStep[] = input.sections.map((section) => {
    const rgs = routed.get(section.id) ?? [];
    const secText = plainText(section.html);
    const skipTerms = followUp && input.seoScore >= SEO_READY;
    const secTerms = (aiTakeover && mode !== 'seo-first') || skipTerms ? [] : sectionMissingTerms(secText, input.context);
    let filteredRgs = rgs;
    if (seoOnly) {
      filteredRgs = rgs.filter((r) => r.guideline.group !== 'knowledge' && r.guideline.group !== 'authority');
    }
    if (aiTakeover && mode === 'ai-only') {
      filteredRgs = rgs.filter((r) => r.guideline.group === 'knowledge' || r.guideline.group === 'intent' || r.guideline.group === 'authority');
    }
    if (followUp && (snapshot?.items.length ?? 0) > 25) {
      filteredRgs = filteredRgs.filter((r) => r.guideline.group !== 'knowledge' || r.guideline.importance === 'critical');
    }
    // first_run: intro gets intent guidelines first when present
    if (!followUp && section.index === 0) {
      const intentRgs = filteredRgs.filter((r) => r.guideline.group === 'intent');
      const rest = filteredRgs.filter((r) => r.guideline.group !== 'intent');
      if (intentRgs.length) filteredRgs = [...intentRgs, ...rest];
    }
    const expectedLift = diminishingLift(filteredRgs.map((r) => r.guideline.projectedLift));

    const base = { sectionId: section.id, index: section.index, headingText: section.headingText, html: section.html, guidelines: filteredRgs, missingTerms: secTerms };

    if (!worthEditing({ expectedLift, rgs: filteredRgs, secTerms, aiTakeover })) {
      return {
        ...base, focus: 'skip', systemPrompt: '', estimatedTokens: 0, expectedLift,
        reason: 'Skipped - below benefit threshold', mode: 'normal',
      };
    }

    const focus = focusFor(filteredRgs, secTerms);
    let editMode: EditMode = snapshot
      ? selectMode({ section, expectedLift, rgs: filteredRgs, snapshot, aiTakeover })
      : 'normal';
    if (mode === 'ai-only' || mode === 'minimal' || followUp) editMode = 'less';
    if (mode === 'full' && focus === 'expand' && !followUp) editMode = 'expand';

    const draft: PlanStep = {
      ...base, focus, expectedLift,
      estimatedTokens: estimateStepTokens(section),
      systemPrompt: '',
      reason: filteredRgs.length ? `Optimize (${mode}): ${filteredRgs.length} guidelines` : `Optimize (${mode}): under-target terms`,
      mode: editMode,
    };
    return {
      ...draft,
      systemPrompt: buildStepPromptForMode(draft, input.context, editMode),
      userInstruction: userInstructionForMode(draft, editMode),
    };
  });

  const { trimmed, ignoredLift } = trimToBudget(steps, input.budgetRemaining);
  const survivingNonSkip = steps.filter((s) => s.focus !== 'skip');
  const rationale = `${phase}/${mode}: ${survivingNonSkip.length}/${steps.length} sections${trimmed ? ` (trimmed, ignored ${ignoredLift} lift)` : ''}`;
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
- When AI Search checkpoints are listed, this section must help answer EVERY uncovered checkpoint — not just some
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

function brandBlock(context: ArticleContext): string {
  const parts: string[] = [];
  if (context.brandKnowledge) parts.push(`Brand context: ${context.brandKnowledge}`);
  if (context.voiceTone) parts.push(`Match this brand voice: ${context.voiceTone}`);
  return parts.length ? `\n\n${parts.join('\n')}` : '';
}

export function buildStepPrompt(step: PlanStep, context: ArticleContext): string {
  if (step.focus === 'skip') return '';
  const brand = brandBlock(context);
  const block = focusBlock(step);
  return `${SHARED_RULES}\n\n${block}${brand}\n\n${NEGATIVE_CONSTRAINTS}\n\n${OUTPUT_RULE}`;
}

const LESS_RULES = `You are an expert SEO content editor making a MINIMAL PATCH to ONE section of an HTML article.

RULES:
- Make a MAXIMUM of 2-5 local edits. Preserve MORE THAN 95% of the original wording verbatim.
- When AI Search checkpoints are listed globally, your patch must help answer EVERY uncovered checkpoint — not just one
- Do NOT add paragraphs. Do NOT rewrite. Do NOT expand or lengthen the section.
- Only patch the specific uncovered AI-search signals listed below — change nothing else.
- Keep the SAME LANGUAGE as the input (auto-detect — do NOT translate)
- Preserve EVERY heading, <a> link, <img>, and list EXACTLY as written`;

function buildLessPrompt(step: PlanStep, context: ArticleContext): string {
  const brand = brandBlock(context);
  // LESS never deepens/expands (intro protection depends on this): a step with focus 'expand' would
  // otherwise render "deepen this section; it is currently shallow", which contradicts LESS_RULES'
  // "Do NOT expand or lengthen". Map 'expand' -> 'ai-coverage' framing for the LESS block only —
  // NORMAL/EXPAND keep the real focusBlock(step) call untouched.
  const lessStep = step.focus === 'expand' ? { ...step, focus: 'ai-coverage' as const } : step;
  const block = focusBlock(lessStep);
  return `${LESS_RULES}\n\n${block}${brand}\n\n${NEGATIVE_CONSTRAINTS}\n\n${OUTPUT_RULE}`;
}

/** Mode -> system prompt. NORMAL/EXPAND delegate to the existing buildStepPrompt byte-for-byte. */
export function buildStepPromptForMode(step: PlanStep, context: ArticleContext, mode: EditMode): string {
  if (step.focus === 'skip') return '';
  return mode === 'less' ? buildLessPrompt(step, context) : buildStepPrompt(step, context);
}

const LESS_USER_BASE =
  'Patch this section with the minimal number of local edits. Do not rewrite it, do not add '
  + 'paragraphs, and preserve more than 95% of the wording. Only fix the signals in the instructions.';
const LESS_INTRO_EXTRA =
  ' If the intro does not directly answer the main question, add at most one short sentence that does '
  + '— never a new paragraph.';

/** Mode -> user message. LESS carries a patch-only instruction; NORMAL/EXPAND stay undefined so the
 *  endpoint uses today's "Improve this section:\n\n"+html literal (byte-for-byte). */
export function userInstructionForMode(step: PlanStep, mode: EditMode): string | undefined {
  if (mode !== 'less') return undefined;
  const extra = step.index === 0 ? LESS_INTRO_EXTRA : '';
  return `${LESS_USER_BASE}${extra}\n\n${step.html}`;
}
