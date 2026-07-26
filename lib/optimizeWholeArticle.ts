import type { ArticleContext } from './articleContext';
import type { Guideline } from './recommendationEngine';
import {
  computeTermUsageGaps,
  type TermUsageGap,
} from './optimizeSectionEdit';
import { selectOptimizeMode, type OptimizeMode } from './optimizeMode';
import type { OptimizePhase } from './optimizeRunPhase';
import type { EditMode, StepFocus } from './optimizationPlanner';
import { buildEffortOptimizeGuidance } from './contentEffort';
import { buildWhatsMissingOptimizeGuidance } from './contentScore';
import { countOccurrences } from './termMatch';
import { STOP_SLOP_RULES } from './stopSlopPrompt';
import { isUncoveredAiSearchItem } from './aiCoverage';

export { computeMissingTerms, computeOverusedTerms } from './optimizeSectionEdit';
export const WHOLE_ARTICLE_ID = 'article-whole';

const STRUCTURE_RULES = `STRUCTURE (write for HUMANS — not for bots / keyword stuffing):
- Prefer a natural editorial flow: short lead (2–4 paragraphs), then H2 sections with SUBSTANCE
- Under each H2: typically 2–5 paragraphs of real prose (≈120–450 characters each). Lists/tables when they help
- DO NOT create a new heading for every short idea. Never produce dozens of thin H2/H3 with ~50-character bodies
- Aim for roughly 6–14 H2 on a long article; use H3 sparingly inside a section, not as a substitute for paragraphs
- H1 at most once (title). Do not spam keyword-stuffed mini-headings
- Each <p> should be readable prose — not a one-line keyword fragment. Split only when a paragraph exceeds ~600–700 characters
- Use <ul>/<ol> for enumerations; <table> for comparisons / numbers
- Preserve links and images; improve descriptive alts when touching images
- You MAY restructure, but the result must still read as a coherent article a person would finish`;

const SHARED_RULES = `You are an expert SEO content editor making surgical edits to a FULL HTML article.

RULES:
- Apply focused edits across the article — refine structure where needed, do not rewrite from scratch into keyword spam
- Tighten weak sentences and remove AI-sounding filler / template phrases
- Prefer unique, hard-to-replicate specifics over generic SEO filler (effort > volume)
- Write for human readers first; SEO terms and AI checkpoints must fit naturally into full paragraphs
- Keep the SAME LANGUAGE as the input (auto-detect — do NOT translate)
- Preserve <a> links, <img>, and list structure unless a change directly serves the focus below
- ${STRUCTURE_RULES}

${STOP_SLOP_RULES}`;

const OUTPUT_RULE = `OUTPUT: ONLY the full article's raw HTML. No markdown code fences, no commentary.`;

function uncoveredAiCheckpoints(ctx: ArticleContext): string[] {
  const primary = (ctx.coverage?.items || [])
    .filter(isUncoveredAiSearchItem)
    .map((i) => i.label);
  if (primary.length) return primary;
  // Fallback: any shallow knowledge/intent left (except SEO presence types)
  return (ctx.coverage?.items || [])
    .filter((i) => (i.category === 'intent' || i.category === 'knowledge')
      && i.type !== 'entity' && i.type !== 'structure' && i.type !== 'readability' && i.type !== 'term'
      && (!i.covered || i.quality < 4))
    .map((i) => i.label);
}

function uniqueVsSerpFromCtx(ctx: ArticleContext | null, plainText: string): { covered: number; total: number } | undefined {
  if (!ctx?.coverage?.items?.length) return undefined;
  const items = ctx.coverage.items.filter((i) => i.type === 'entity' || i.type === 'paa' || i.type === 'intent');
  if (!items.length) return undefined;
  const covered = items.filter((i) => i.covered || countOccurrences(plainText, i.label) >= 1).length;
  return { covered, total: items.length };
}

function effortBlock(ctx: ArticleContext | null, html: string): string {
  const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return buildEffortOptimizeGuidance({
    html,
    plainText,
    keyword: ctx?.keyword,
    paaQuestions: ctx?.paa?.length ? ctx.paa : ctx?.scoreData?.paa_questions,
    uniqueVsSerp: uniqueVsSerpFromCtx(ctx, plainText),
  });
}

/**
 * Mode selects a preference, but NLP term debt overrides "minimal/ai polish".
 * SEO gauges can read "ready" (≥66) from structure/keyword placement while most
 * multi-word NLP terms are still 0 — Auto-Optimize must still close those gaps.
 *
 * ai-only with an empty coverage snapshot used to force a vague AI focus + "less"
 * (preserve 90%) → model echoed the article → client "didn't change this time".
 * Prefer concrete SEO term debt when there are no uncovered AI checkpoints.
 *
 * When SEO is already strong, stay on AI Search (facts/formatting) — do not fall
 * through to timid readability polish that echoes the article (no_change).
 */
function focusForMode(mode: OptimizeMode, ctx: ArticleContext | null, html: string): StepFocus {
  const gaps = ctx ? computeTermUsageGaps(ctx.scoreData ?? undefined, html) : [];
  const hasTermDebt = gaps.some((g) => g.status === 'missing' || g.status === 'low' || g.status === 'overuse');
  const hasOveruse = gaps.some((g) => g.status === 'overuse');
  const uncoveredItems = (ctx?.coverage?.items || []).filter(isUncoveredAiSearchItem);
  const uncovered = uncoveredItems.map((i) => i.label);
  // Shallow = checklist already "Covered" but quality < 4. Whole-article AI polish then echoes → no_change.
  // Prefer SEO term balance (esp. overuse) first; FAQ round still deepens shallow AI checkpoints.
  const onlyShallowAi = uncoveredItems.length > 0 && uncoveredItems.every((i) => i.covered);

  if (mode === 'ai-only') {
    if (hasOveruse && onlyShallowAi) return 'seo-terms';
    if (uncovered.length > 0 && !onlyShallowAi) return 'ai-coverage';
    if (hasTermDebt) return 'seo-terms';
    if (uncovered.length > 0) return 'ai-coverage';
    if ((ctx?.paa?.length ?? 0) > 0) return 'ai-coverage';
    return 'ai-coverage';
  }
  if (mode === 'seo-first') return 'seo-terms';
  if (hasTermDebt) return 'seo-terms';
  if (mode === 'minimal') return 'ai-coverage';
  if (uncovered.length > 0) return 'ai-coverage';
  return 'readability';
}

/**
 * `less` (= preserve ≥90% wording) is for polish passes. Large AI/SEO gaps need
 * `normal` or the whole-article path echoes the input and AO reports no_change.
 */
function editModeForFocus(focus: StepFocus, mode: OptimizeMode): EditMode {
  if (focus === 'seo-terms') return 'normal';
  if (mode === 'ai-only') return 'normal';
  if (mode === 'minimal') return 'less';
  if (focus === 'ai-coverage') return 'less';
  return 'less';
}

function formatGapLine(g: TermUsageGap): string {
  return `- "${g.term}" (${g.current}/${g.target})`;
}

function seoTermsFocusBlock(gaps: TermUsageGap[]): string {
  const under = gaps
    .filter((g) => g.status === 'missing' || g.status === 'low')
    .sort((a, b) => (b.target - b.current) - (a.target - a.current))
    .slice(0, 30);
  const over = gaps
    .filter((g) => g.status === 'overuse')
    .sort((a, b) => (b.current - b.target) - (a.current - a.target))
    .slice(0, 12);

  if (!under.length && !over.length) return '';

  const parts: string[] = [
    'FOCUS — SEO term balance (natural prose in existing H2 sections — do NOT invent a new H2/H3 per term):',
    '- Prefer multi-word phrases over repeating short root words',
    '- Weave exact phrases where they fit; do not keyword-stuff',
  ];

  if (under.length) {
    parts.push(
      'UNDERUSED — add until near target (current/target):',
      ...under.map(formatGapLine),
    );
  }
  if (over.length) {
    parts.push(
      'OVERUSED — reduce toward target by rephrasing; replace surplus short roots with UNDERUSED multi-word phrases above (keep meaning):',
      ...over.map(formatGapLine),
    );
  }
  return parts.join('\n');
}

function focusBlock(focus: StepFocus, ctx: ArticleContext | null, html: string, guidelines: Guideline[]): string {
  if (focus === 'seo-terms' && ctx?.scoreData) {
    const gaps = computeTermUsageGaps(ctx.scoreData, html);
    const block = seoTermsFocusBlock(gaps);
    if (block) return block;
  }
  if (focus === 'ai-coverage') {
    const uncovered = ctx ? uncoveredAiCheckpoints(ctx) : [];
    const batch = uncovered.slice(0, 10);
    const guideLines = guidelines
      .filter((g) => g.group === 'knowledge' || g.group === 'intent' || g.group === 'authority')
      .slice(0, 8)
      .map((g) => `- ${g.title}: ${g.instruction}`)
      .join('\n');
    const lines: string[] = [];
    if (batch.length) {
      lines.push(
        `AI Search — improve coverage for these checkpoints (max ${batch.length} this round). `
        + `For each: weave an answer into a full H2 section with several readable paragraphs (not a one-line stub). `
        + `Do NOT try to answer ALL questions inline — uncovered AI Search Q&A will be added in a separate FAQ section:\n`
        + batch.map((l) => `- ${l}`).join('\n'),
      );
    }
    if (guideLines) lines.push(`Apply these guidelines:\n${guideLines}`);
    return lines.length ? `FOCUS — maximize AI Search fact coverage:\n${lines.join('\n\n')}` : 'FOCUS — improve AI-search answer readiness across the article.';
  }
  if (focus === 'readability') {
    return 'FOCUS — improve readability for humans: merge thin heading spam into fuller H2 sections; expand stub paragraphs; keep prose scannable without robot-like mini-sections.';
  }
  return '';
}

function gapsBlock(ctx: ArticleContext | null, html: string): string {
  if (!ctx?.scoreData) return '';
  return buildWhatsMissingOptimizeGuidance({
    html,
    scoreData: ctx.scoreData,
    keyword: ctx.keyword,
    coverageItems: ctx.coverage?.items,
  });
}

function brandBlock(ctx: ArticleContext | null): string {
  if (!ctx) return '';
  const parts: string[] = [];
  if (ctx.brandKnowledge) parts.push(`Brand context: ${ctx.brandKnowledge}`);
  if (ctx.voiceTone) parts.push(`Match this brand voice: ${ctx.voiceTone}`);
  return parts.length ? `\n\n${parts.join('\n')}` : '';
}

export function buildWholeArticlePrompt(opts: {
  ctx: ArticleContext | null;
  html: string;
  guidelines: Guideline[];
  seoScore: number;
  aiScore: number;
  phase: OptimizePhase;
  mode?: OptimizeMode;
  /** Surgical Priority Action — single focused instruction. */
  focusInstruction?: string;
}): { systemPrompt: string; userInstruction: string; focus: StepFocus; editMode: EditMode; reason: string } {
  const mode = opts.mode ?? selectOptimizeMode(opts.seoScore, opts.aiScore, opts.phase);
  const focus = focusForMode(mode, opts.ctx, opts.html);
  const editMode = opts.focusInstruction ? 'less' : editModeForFocus(focus, mode);
  const block = opts.focusInstruction
    ? `FOCUS — Priority Action (surgical):\n${opts.focusInstruction}`
    : focusBlock(focus, opts.ctx, opts.html, opts.guidelines);
  const gaps = opts.focusInstruction ? '' : gapsBlock(opts.ctx, opts.html);
  const effort = opts.focusInstruction ? '' : effortBlock(opts.ctx, opts.html);
  const brand = brandBlock(opts.ctx);

  // When minimal mode still has term debt, allow normal (not patch-only) edits so
  // the model can redistribute phrases — "less" was too timid for 20+ missing terms.
  // ai-only already uses normal via editModeForFocus.
  const effectiveEditMode: EditMode =
    opts.focusInstruction
      ? 'less'
      : (mode === 'minimal' && focus === 'seo-terms')
        ? 'normal'
        : editMode;

  const lessRules = effectiveEditMode === 'less'
    ? '\n- Make targeted patches — preserve more than 90% of existing wording\n- Prefer fuller sections over adding many thin headings'
    : '';

  const gapsSection = gaps ? `\n\n${gaps}` : '';
  const effortSection = effort ? `\n\n${effort}` : '';
  const systemPrompt = `${SHARED_RULES}${lessRules}\n\n${block}${gapsSection}${effortSection}${brand}\n\n${OUTPUT_RULE}`;
  const userInstruction = opts.focusInstruction
    ? 'Apply ONLY the Priority Action above with minimal, targeted edits. Return the complete HTML article.'
    : effectiveEditMode === 'less'
      ? "Improve this FULL article with minimal, targeted edits. Write for humans — full sections, not heading spam. Close WHAT'S MISSING and EFFORT gaps when listed. Return the complete HTML article."
      : "Improve this FULL article according to the focus instructions. Write for humans — full sections, not heading spam. Balance UNDERUSED/OVERUSED SEO terms when listed. Close WHAT'S MISSING and EFFORT gaps when listed. Return the complete HTML article.";

  const reason = opts.focusInstruction
    ? 'Surgical Priority Action'
    : focus === 'ai-coverage'
      ? 'Whole-article AI coverage'
      : focus === 'seo-terms'
        ? 'Whole-article SEO terms'
        : 'Whole-article readability';

  return { systemPrompt, userInstruction, focus, editMode: effectiveEditMode, reason };
}
