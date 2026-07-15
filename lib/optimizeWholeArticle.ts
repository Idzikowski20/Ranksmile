import type { ArticleContext } from './articleContext';
import type { Guideline } from './recommendationEngine';
import { computeMissingTerms } from './optimizeSectionEdit';
import { selectOptimizeMode, type OptimizeMode } from './optimizeMode';
import type { OptimizePhase } from './optimizeRunPhase';
import type { EditMode, StepFocus } from './optimizationPlanner';

export const WHOLE_ARTICLE_ID = 'article-whole';

const STRUCTURE_RULES = `STRUCTURE (mandatory):
- Split dense blocks: prefer MANY H2/H3 headings, each followed by 1–2 SHORT paragraphs
- Each <p> under a heading: 100–200 characters of plain text (NOT words). If longer → split into new <p> or new subheading
- When covering an NLP term or AI checkpoint: dedicate a heading (H2/H3) + short paragraph — never stuff keywords into one wall
- Use <ul>/<ol> for steps, requirements, or 3+ related points
- Use <table> for comparisons, pros/cons, or multi-column facts
- NEVER output a single paragraph longer than 250 characters
- NEVER prepend keyword phrases to sentences (e.g. "Keyword - definition Keyword is…") — use proper <h2>/<h3> headings instead
- You MAY add new headings and split existing paragraphs; you MAY shorten bloated sentences`;

const SHARED_RULES = `You are an expert SEO content editor making surgical edits to a FULL HTML article.

RULES:
- Apply focused edits across the article — refine structure where needed, do not rewrite from scratch
- Tighten weak sentences and remove AI-sounding filler
- Keep the SAME LANGUAGE as the input (auto-detect — do NOT translate)
- Preserve <a> links, <img>, and list structure unless a change directly serves the focus below
- ${STRUCTURE_RULES}`;

const OUTPUT_RULE = `OUTPUT: ONLY the full article's raw HTML. No markdown code fences, no commentary.`;

function uncoveredAiCheckpoints(ctx: ArticleContext): string[] {
  return (ctx.coverage?.items || [])
    .filter((i) =>
      (i.category === 'intent' || i.category === 'knowledge')
      && (i.type === 'paa' || i.type === 'fact' || i.type === 'intent' || i.type === 'definition' || i.type === 'comparison')
      && (!i.covered || i.quality < 4),
    )
    .map((i) => i.label);
}

function focusForMode(mode: OptimizeMode, ctx: ArticleContext | null, html: string): StepFocus {
  if (mode === 'ai-only' || mode === 'minimal') return 'ai-coverage';
  if (mode === 'seo-first') return 'seo-terms';
  const missing = ctx ? computeMissingTerms(ctx.scoreData ?? undefined, html) : [];
  if (missing.length > 0) return 'seo-terms';
  const uncovered = ctx ? uncoveredAiCheckpoints(ctx) : [];
  if (uncovered.length > 0) return 'ai-coverage';
  return 'readability';
}

function editModeForFocus(focus: StepFocus, mode: OptimizeMode): EditMode {
  if (mode === 'ai-only' || mode === 'minimal') return 'less';
  if (focus === 'ai-coverage') return 'less';
  if (focus === 'seo-terms') return 'normal';
  return 'less';
}

function focusBlock(focus: StepFocus, ctx: ArticleContext | null, html: string, guidelines: Guideline[]): string {
  if (focus === 'seo-terms' && ctx?.scoreData) {
    const missing = computeMissingTerms(ctx.scoreData, html).slice(0, 30);
    if (missing.length) {
      return `FOCUS — place each MISSING NLP term in a heading or first sentence of a short paragraph under its own H2/H3: ${missing.map((t) => `"${t}"`).join(', ')}`;
    }
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
        + `For each: add or extend a dedicated H2/H3 section with a 100–200 char paragraph. `
        + `Do NOT try to answer ALL questions inline — uncovered AI Search Q&A will be added in a separate FAQ section:\n`
        + batch.map((l) => `- ${l}`).join('\n'),
      );
    }
    if (guideLines) lines.push(`Apply these guidelines:\n${guideLines}`);
    return lines.length ? `FOCUS — maximize AI Search fact coverage:\n${lines.join('\n\n')}` : 'FOCUS — improve AI-search answer readiness across the article.';
  }
  if (focus === 'readability') return 'FOCUS — improve readability: split walls of text into H2/H3 + short paragraphs (100–200 chars each), add lists/tables where helpful.';
  return '';
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
}): { systemPrompt: string; userInstruction: string; focus: StepFocus; editMode: EditMode; reason: string } {
  const mode = opts.mode ?? selectOptimizeMode(opts.seoScore, opts.aiScore, opts.phase);
  const focus = focusForMode(mode, opts.ctx, opts.html);
  const editMode = editModeForFocus(focus, mode);
  const block = focusBlock(focus, opts.ctx, opts.html, opts.guidelines);
  const brand = brandBlock(opts.ctx);

  const lessRules = editMode === 'less'
    ? '\n- Make targeted patches — preserve more than 90% of existing wording\n- Split bloated paragraphs into headings + short paragraphs per STRUCTURE rules'
    : '';

  const systemPrompt = `${SHARED_RULES}${lessRules}\n\n${block}${brand}\n\n${OUTPUT_RULE}`;
  const userInstruction = editMode === 'less'
    ? 'Improve this FULL article with minimal, targeted edits. Follow STRUCTURE rules — many H2/H3, short paragraphs. Return the complete HTML article.'
    : 'Improve this FULL article according to the focus instructions. Follow STRUCTURE rules. Return the complete HTML article.';

  const reason = focus === 'ai-coverage'
    ? 'Whole-article AI coverage'
    : focus === 'seo-terms'
      ? 'Whole-article SEO terms'
      : 'Whole-article readability';

  return { systemPrompt, userInstruction, focus, editMode, reason };
}
