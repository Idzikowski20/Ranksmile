/**
 * Shared WIE Writer — one LLM path + Judge (RX + EEAT + Quality).
 * Used by AO precision llmEdit and /api/wie/write.
 */
import { buildWieWriteContext, formatWieWriteBlocks, type WieWriteContext } from './writerContext';
import { evaluateRxQualityGate, type RxGateResult } from './rxQualityGate';
import { judgeArticleQuality, type QualityJudgeResult } from './qualityJudge';
import { scoreEeat, EEAT_SOFT_FLOOR, type EeatBreakdown } from './eeatScore';
import type { CompetitorSynthesis } from './competitorSynthesis';
import { openingPolicyViolated } from './enforceOpeningPolicy';

export type WieJudgeResult = {
  ok: boolean;
  rx: RxGateResult;
  eeat: EeatBreakdown;
  quality: QualityJudgeResult;
  reasons: string[];
};

export type WieWriteResult = {
  html: string;
  tokens: number;
  judge: WieJudgeResult;
  wie?: WieWriteContext;
};

function stripFences(s: string): string {
  return s
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

type ChatCompletionJson = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { total_tokens?: number };
};

function parseChatCompletion(data: unknown): { content: string; totalTokens: number } {
  const d = data as ChatCompletionJson;
  const content = d?.choices?.[0]?.message?.content || '';
  const totalTokens = typeof d?.usage?.total_tokens === 'number' ? d.usage.total_tokens : 0;
  return { content, totalTokens };
}

/** System preamble shared by all WIE Writer consumers. */
export function wieWriterSystemPrompt(): string {
  return [
    'You are the Ranksmile Writing Intelligence Writer.',
    'Follow any POLICY, NARRATIVE, READER, and COVERAGE BUDGET blocks in the user message.',
    'Never invent credentials, case studies, or guaranteed rankings.',
    'Prefer concrete examples and problem-first openings when policy says so.',
    'HARD: When POLICY includes opening:problem_first, the first body paragraph MUST open with the reader’s problem/stakes — never a dictionary lead (“X to…”, “X jest…”).',
    'Do not pad optional topics at the expense of critical depth.',
    'Return HTML only — no markdown fences unless the user asks for plain text.',
  ].join(' ');
}

/** Unified Judge: RX veto + EEAT floor + quality signals + optional opening policy. */
export function wieJudgeHtml(opts: {
  html: string;
  action?: string;
  synthesis?: CompetitorSynthesis | null;
  /** When true, apply EEAT soft floor as hard veto */
  requireEeat?: boolean;
  /** WIE opening decision value (e.g. problem_first) */
  expectedOpening?: string | null;
}): WieJudgeResult {
  const action = opts.action || 'rewrite_section';
  const rx = evaluateRxQualityGate({
    afterHtml: opts.html,
    action,
    synthesis: opts.synthesis,
  });
  const eeat = scoreEeat(opts.html);
  const quality = judgeArticleQuality({ html: opts.html, threshold: 50 });
  const reasons: string[] = [];

  if (!rx.ok) reasons.push(`rx:${rx.reason}`);
  if (opts.requireEeat !== false && eeat.score < EEAT_SOFT_FLOOR) {
    reasons.push(`eeat_below_floor:${eeat.score}`);
  }
  if (eeat.reasons.includes('fake_credentials_penalty')) {
    reasons.push('fake_credentials');
  }
  if (opts.expectedOpening === 'problem_first') {
    if (openingPolicyViolated(opts.html, opts.expectedOpening)) {
      reasons.push('opening_policy_violation');
    }
  }

  const ok =
    rx.ok
    && !eeat.reasons.includes('fake_credentials_penalty')
    && (opts.requireEeat === false || eeat.score >= EEAT_SOFT_FLOOR)
    && !reasons.includes('opening_policy_violation');

  return { ok, rx, eeat, quality, reasons };
}

/**
 * LLM completion with WIE system prompt.
 * Injectable `llmEdit` for tests / AO reuse.
 */
export async function wieLlmComplete(opts: {
  userPrompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  /** Ask the provider to enforce valid JSON. Asking in the prompt alone is not enough. */
  json?: boolean;
  signal?: AbortSignal;
  llmEdit?: (userPrompt: string, systemPrompt: string) => Promise<{ html: string; tokens: number }>;
}): Promise<{ html: string; tokens: number }> {
  const system = opts.systemPrompt || wieWriterSystemPrompt();
  if (opts.llmEdit) {
    return opts.llmEdit(opts.userPrompt, system);
  }

  const { chatLlm } = await import('../ai/deepseek');
  const llm = chatLlm();
  if (!llm.apiKey) {
    throw new Error(`${llm.keyEnv} not configured`);
  }

  const maxTokens = opts.maxTokens ?? 4000;
  const body: Record<string, unknown> = {
    model: llm.model,
    max_tokens: maxTokens,
    temperature: opts.temperature ?? 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: opts.userPrompt },
    ],
  };
  // "Reply with JSON only" in the prompt is a request, not a guarantee: sampled replies
  // came back closing a section object without closing its instructions array, and one
  // malformed character costs the whole call. The provider's own JSON mode enforces it.
  if (opts.json) body.response_format = { type: 'json_object' };

  const aiRes = await fetch(llm.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llm.apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://ranksmile.pl',
      'X-Title': 'Ranksmile',
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!aiRes.ok) throw new Error(`HTTP ${aiRes.status}`);
  const data = parseChatCompletion(await aiRes.json());
  return { html: stripFences(data.content), tokens: data.totalTokens };
}

/**
 * Full Write path: optional WIE context inject → LLM → Judge.
 */
export async function wieWrite(opts: {
  userPrompt: string;
  keyword?: string;
  action?: string;
  scoreData?: { competitor_synthesis?: unknown } | null;
  injectWieBlocks?: boolean;
  requireEeat?: boolean;
  signal?: AbortSignal;
  llmEdit?: (userPrompt: string, systemPrompt: string) => Promise<{ html: string; tokens: number }>;
}): Promise<WieWriteResult> {
  let wie: WieWriteContext | undefined;
  let prompt = opts.userPrompt;
  if (opts.injectWieBlocks && opts.keyword) {
    wie = await buildWieWriteContext({
      keyword: opts.keyword,
      scoreData: opts.scoreData,
    });
    const blocks = formatWieWriteBlocks(wie);
    if (blocks) prompt = `${blocks}\n\n${opts.userPrompt}`;
  }

  const { html, tokens } = await wieLlmComplete({
    userPrompt: prompt,
    signal: opts.signal,
    llmEdit: opts.llmEdit,
  });

  const judge = wieJudgeHtml({
    html,
    action: opts.action,
    synthesis: wie?.synthesis,
    requireEeat: opts.requireEeat,
    expectedOpening: wie?.policy?.decisions.find((d) => d.id === 'opening')?.value,
  });

  return { html, tokens, judge, wie };
}
