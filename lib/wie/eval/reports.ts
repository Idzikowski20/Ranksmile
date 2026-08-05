/**
 * Dual reports: technical.md + editorial.md + verdict.json
 */
import type { ScorecardResult } from './scorecard';
import type { EditorialJudgeResult, EditorialJudgeStatus } from './editorialJudge';
import {
  formatEditorialReviewMarkdown,
  formatRewriteActionsMarkdown,
  formatWeaknessItemsMarkdown,
} from './editorialJudge';
import type { CompetitorBenchmarkResult } from './competitorBenchmark';
import { formatBenchmarkMarkdown } from './competitorBenchmark';
import type { ExplainabilityRecord } from '../explainability';
import type { PublishGateResult, RootIntentCoverage } from './publishGate';
import { formatPublishGateMarkdown } from './publishGate';
import { formatBeatsBreakdown, reconcileBeatsTop5 } from './verdictAlign';
import type { PolicyComplianceResult } from './policyCompliance';
import { formatPolicyComplianceMarkdown } from './policyCompliance';

export type TechnicalReportInput = {
  runId: string;
  keyword: string;
  articleId?: number;
  domainId?: number;
  timings: Record<string, number>;
  tokens?: number;
  scoresBefore: { seo: number; ai: number; content: number };
  scoresAfter: { seo: number; ai: number; content: number };
  termsCount: number;
  competitorsCount: number;
  coverageTotal: number;
  coverageCovered: number;
  rxVetoes?: number;
  pipelineOk: boolean;
  errors: string[];
  logs: string[];
  /** Full AO HTML (also written as article.after.html) */
  articleHtmlAfter?: string;
  articleHtmlBefore?: string;
};

export type EditorialReportInput = {
  runId: string;
  keyword: string;
  scorecard: ScorecardResult;
  judge: EditorialJudgeStatus;
  benchmark: CompetitorBenchmarkResult | null;
  explainability: ExplainabilityRecord[];
  dnaVersion?: number;
  pipelineOk?: boolean;
  /** Full article HTML after AO — embedded for daily reading */
  articleHtml?: string;
  publishGate?: PublishGateResult | null;
  rootIntent?: RootIntentCoverage | null;
  /** Reconciled beats_top5 (benchmark-first) */
  beatsTop5?: 'wins' | 'ties' | 'loses' | 'unknown';
  policyCompliance?: PolicyComplianceResult | null;
};

function formatHtmlBlock(title: string, html: string | undefined): string {
  const body = (html || '').trim();
  if (!body) return `## ${title}\n\n_empty_`;
  return [`## ${title}`, '', '```html', body, '```'].join('\n');
}

export type VerdictJson = {
  writing_intelligence: number;
  pipeline_ok: boolean;
  beats_top5: 'wins' | 'ties' | 'loses' | 'unknown';
  category_scores: Record<string, number>;
  benchmark_winners: Record<string, string>;
  lead_encourages?: number;
  sounds_expert?: number;
  answers_intent?: number;
  better_than_top5?: number;
  publish_ready?: boolean;
  publish_decision?: 'READY' | 'NOT READY';
  root_intent_coverage?: number;
  policy_violations?: number;
  policy_passed?: number;
};

export function buildTechnicalMarkdown(t: TechnicalReportInput): string {
  const dSeo = t.scoresAfter.seo - t.scoresBefore.seo;
  const dAi = t.scoresAfter.ai - t.scoresBefore.ai;
  const lines = [
    `# Technical Report — ${t.runId}`,
    '',
    `Keyword: **${t.keyword}** · articleId: ${t.articleId ?? '—'} · domainId: ${t.domainId ?? '—'}`,
    '',
    `## Pipeline: ${t.pipelineOk ? 'OK' : 'FAILED'}`,
    '',
    '### Timings (ms)',
    ...Object.entries(t.timings).map(([k, v]) => `- ${k}: ${v}`),
    '',
    `Tokens (approx): ${t.tokens ?? '—'}`,
    '',
    '### Scores',
    `| | Before | After | Δ |`,
    `| --- | --- | --- | --- |`,
    `| SEO | ${t.scoresBefore.seo} | ${t.scoresAfter.seo} | ${dSeo} |`,
    `| AI | ${t.scoresBefore.ai} | ${t.scoresAfter.ai} | ${dAi} |`,
    `| Content | ${t.scoresBefore.content} | ${t.scoresAfter.content} | ${t.scoresAfter.content - t.scoresBefore.content} |`,
    '',
    '### Artifacts counts',
    `- Terms: ${t.termsCount}`,
    `- Competitors: ${t.competitorsCount}`,
    `- Coverage: ${t.coverageCovered}/${t.coverageTotal}`,
    `- RX vetoes: ${t.rxVetoes ?? 0}`,
    '',
    '### Errors',
    ...(t.errors.length ? t.errors.map((e) => `- ${e}`) : ['- none']),
    '',
    '### Artifact files',
    '- `article.before.html`',
    '- `article.after.html`',
    '',
    '### Logs',
    '```',
    ...t.logs.slice(-80),
    '```',
    '',
  ];
  if (t.articleHtmlBefore?.trim()) {
    lines.push(formatHtmlBlock('Article HTML — before AO', t.articleHtmlBefore), '');
  }
  if (t.articleHtmlAfter?.trim()) {
    lines.push(formatHtmlBlock('Article HTML — after AO', t.articleHtmlAfter), '');
  }
  return lines.join('\n');
}

function formatExplainability(recs: ExplainabilityRecord[]): string {
  if (!recs.length) return '_No WIE explainability records._';
  const lines = ['## Explainability', ''];
  for (const r of recs) {
    const conf = Math.round(r.confidence * 100);
    lines.push(
      `- **${r.decision}** → ${r.source_layer}`
      + (r.principle_id ? ` · principle \`${r.principle_id}\`` : '')
      + ` · conf **${conf}%**`
      + (r.variant ? ` · variant ${r.variant}` : ''),
    );
    if (r.reason) lines.push(`  - ${r.reason}`);
  }
  return lines.join('\n');
}

export function buildEditorialMarkdown(e: EditorialReportInput): string {
  const wi = e.scorecard.writingIntelligence;
  const beats = e.beatsTop5
    ?? (e.judge.status === 'ok' ? e.judge.result.vs_top5.overall : 'unknown');
  const pipelineOk = e.pipelineOk !== false;
  const publishOk = e.publishGate ? e.publishGate.ready : true;
  const verdict =
    pipelineOk && publishOk && wi >= 75 && beats === 'wins'
      ? 'STRONG'
      : !publishOk
        ? 'NOT READY'
        : wi >= 60
          ? 'MIXED'
          : 'WEAK';

  const lines = [
    `# Editorial Report — ${e.runId}`,
    '',
    `## Final Verdict: **${verdict}**`,
    '',
    `**Writing Intelligence: ${wi}/100** · vs Top5: **${beats}**`,
    '',
  ];

  if (e.publishGate) {
    lines.push(formatPublishGateMarkdown(e.publishGate), '');
  }

  if (e.policyCompliance) {
    lines.push(formatPolicyComplianceMarkdown(e.policyCompliance), '');
  }

  lines.push(
    '### Scorecard',
    '| Category | Score | Weight |',
    '| --- | --- | --- |',
    `| Reader Experience | ${e.scorecard.parts.readerExperience.toFixed(0)} | 20% |`,
    `| Narrative | ${e.scorecard.parts.narrative.toFixed(0)} | 15% |`,
    `| Expert Voice | ${e.scorecard.parts.expertVoice.toFixed(0)} | 15% |`,
    `| Information Gain | ${e.scorecard.parts.informationGain.toFixed(0)} | 15% |`,
    `| SEO | ${e.scorecard.parts.seo.toFixed(0)} | 10% |`,
    `| Coverage | ${e.scorecard.parts.coverage.toFixed(0)} | 10% |`,
    `| EEAT | ${e.scorecard.parts.eeat.toFixed(0)} | 10% |`,
    `| Pattern Usage | ${e.scorecard.parts.patternUsage.toFixed(0)} | 5% |`,
    '',
    `DNA version: ${e.dnaVersion ?? '—'}`,
    '',
  );

  if (e.rootIntent) {
    lines.push(
      '### Root Intent Coverage',
      '',
      `**${e.rootIntent.score}/10** — ${e.rootIntent.note}`,
      `- Action steps: ${e.rootIntent.has_action_steps ? 'yes' : 'no'}`,
      `- Answers “what to do”: ${e.rootIntent.answers_what_to_do ? 'yes' : 'no'}`,
      '',
    );
  }

  if (e.judge.status === 'ok') {
    lines.push('## Code review', '', formatEditorialReviewMarkdown(e.judge.result), '');
    const weakMd = formatWeaknessItemsMarkdown(e.judge.result.weakness_items);
    if (weakMd) lines.push(weakMd, '');
    const actMd = formatRewriteActionsMarkdown(e.judge.result.recommended_actions);
    if (actMd) lines.push(actMd, '');
  } else {
    const reason = 'reason' in e.judge ? e.judge.reason : '';
    lines.push('## Code review', '', `_Judge ${e.judge.status}: ${reason}_`, '');
  }

  if (e.benchmark) {
    lines.push(formatBenchmarkMarkdown(e.benchmark), '');
    lines.push(`_Breakdown:_ ${formatBeatsBreakdown(e.benchmark)}`, '');
  }

  lines.push(formatExplainability(e.explainability), '');
  if (e.articleHtml?.trim()) {
    lines.push(formatHtmlBlock('Full article HTML', e.articleHtml));
  }
  return lines.join('\n');
}

export function buildVerdictJson(opts: {
  scorecard: ScorecardResult;
  pipelineOk: boolean;
  judge: EditorialJudgeStatus;
  benchmark: CompetitorBenchmarkResult | null;
  publishGate?: PublishGateResult | null;
  rootIntent?: RootIntentCoverage | null;
  policyCompliance?: PolicyComplianceResult | null;
}): VerdictJson {
  const judgeOverall = opts.judge.status === 'ok' ? opts.judge.result.vs_top5.overall : undefined;
  const beats = reconcileBeatsTop5({
    benchmark: opts.benchmark,
    judgeOverall,
  });
  const category_scores: Record<string, number> = {};
  if (opts.judge.status === 'ok') {
    const c = opts.judge.result.categories;
    category_scores.narrative = c.narrative.score;
    category_scores.reader_experience = c.reader_experience.score;
    category_scores.expert_voice = c.expert_voice.score;
    category_scores.information_gain = c.information_gain.score;
    category_scores.trust = c.trust.score;
    category_scores.examples = c.examples.score;
  }
  return {
    writing_intelligence: opts.scorecard.writingIntelligence,
    pipeline_ok: opts.pipelineOk,
    beats_top5: beats,
    category_scores,
    benchmark_winners: opts.benchmark?.winners ?? {},
    lead_encourages: opts.judge.status === 'ok' ? opts.judge.result.lead_encourages : undefined,
    sounds_expert: opts.judge.status === 'ok' ? opts.judge.result.sounds_expert : undefined,
    answers_intent: opts.judge.status === 'ok' ? opts.judge.result.answers_intent : undefined,
    better_than_top5: opts.judge.status === 'ok' ? opts.judge.result.better_than_top5 : undefined,
    publish_ready: opts.publishGate?.ready,
    publish_decision: opts.publishGate?.decision,
    root_intent_coverage: opts.rootIntent?.score
      ?? (opts.judge.status === 'ok' ? opts.judge.result.root_intent_coverage : undefined),
    policy_violations: opts.policyCompliance?.failed,
    policy_passed: opts.policyCompliance?.passed,
  };
}

export type { EditorialJudgeResult };
