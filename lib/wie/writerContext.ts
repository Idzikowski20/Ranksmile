/**
 * Shared WIE Think→Write context for AO, Brief, whole-article, coverage.
 */
import { parseCompetitorSynthesis, formatCompetitorSynthesisForPrompt, type CompetitorSynthesis } from './competitorSynthesis';
import { buildHeuristicReaderBrief, formatReaderBriefForPrompt, type ReaderBrief } from './readerBrief';
import { buildPolicyContext, resolvePolicyBundle, formatPolicyBundleForPrompt, type PolicyBundle, type PolicyContext } from './policyResolver';
import { buildNarrativePlan, formatNarrativePlanForPrompt, type NarrativePlan } from './narrativePlanner';
import { bundleToExplainability, type ExplainabilityRecord } from './explainability';
import { formatContentPlannerForPrompt } from '../contentPlanner/formatPrompt';
import type { ContentPlannerBundle } from '../contentPlanner/types';

export type WieWriteContext = {
  synthesis: CompetitorSynthesis | null;
  readerBrief: ReaderBrief | null;
  policy: PolicyBundle | null;
  narrative: NarrativePlan | null;
  policyCtx: PolicyContext | null;
  explainability: ExplainabilityRecord[];
  contentPlanner?: ContentPlannerBundle | null;
};

/** Budget hint: critical > important > optional — never dump HTML. */
export function formatBoundedCoverageForPrompt(synth: CompetitorSynthesis | null | undefined): string {
  if (!synth) return '';
  const lines = ['COVERAGE BUDGET (Writing Intelligence):'];
  if (synth.critical.length) {
    lines.push('- CRITICAL (must address with depth, not one-liners):');
    for (const c of synth.critical.slice(0, 6)) lines.push(`  • ${c}`);
  }
  if (synth.important.length) {
    lines.push('- IMPORTANT (cover after critical):');
    for (const c of synth.important.slice(0, 5)) lines.push(`  • ${c}`);
  }
  if (synth.optional.length) {
    lines.push('- OPTIONAL (skip if it would dilute critical depth):');
    for (const c of synth.optional.slice(0, 4)) lines.push(`  • ${c}`);
  }
  lines.push('- Do not pad optional topics at the expense of critical ones.');
  return lines.length > 2 ? lines.join('\n') : '';
}

export async function buildWieWriteContext(opts: {
  keyword: string;
  title?: string;
  paa?: string[];
  scoreData?: { competitor_synthesis?: unknown; content_planner_v2?: { bundle?: ContentPlannerBundle } } | null;
  synthesis?: CompetitorSynthesis | null;
  readerBrief?: ReaderBrief | null;
}): Promise<WieWriteContext> {
  const keyword = (opts.keyword || '').trim();
  const synthesis =
    opts.synthesis
    ?? parseCompetitorSynthesis(opts.scoreData?.competitor_synthesis ?? null);
  const readerBrief =
    opts.readerBrief
    ?? (keyword ? buildHeuristicReaderBrief({ keyword, title: opts.title, paa: opts.paa }) : null);

  let policy: PolicyBundle | null = null;
  let policyCtx: PolicyContext | null = null;
  try {
    if (keyword) {
      policyCtx = buildPolicyContext({ keyword, title: opts.title, readerBrief, synthesis });
      policy = await resolvePolicyBundle({ ctx: policyCtx, synthesis });
    }
  } catch {
    policy = null;
    policyCtx = null;
  }

  const narrative = buildNarrativePlan({ readerBrief, policy, synthesis });
  const explainability = policyCtx ? bundleToExplainability(policy, policyCtx) : [];
  const contentPlanner = opts.scoreData?.content_planner_v2?.bundle ?? null;

  return { synthesis, readerBrief, policy, narrative, policyCtx, explainability, contentPlanner };
}

/** Single prompt block for any Writer consumer. */
export function formatWieWriteBlocks(ctx: WieWriteContext | null | undefined): string {
  if (!ctx) return '';
  return [
    formatContentPlannerForPrompt(ctx.contentPlanner),
    formatReaderBriefForPrompt(ctx.readerBrief),
    formatPolicyBundleForPrompt(ctx.policy),
    formatNarrativePlanForPrompt(ctx.narrative),
    formatCompetitorSynthesisForPrompt(ctx.synthesis),
    formatBoundedCoverageForPrompt(ctx.synthesis),
  ].filter(Boolean).join('\n\n');
}
