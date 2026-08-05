/**
 * Editorial Judge — LLM evaluator (not Writer). Code-review style rubrics.
 */
import { safeJsonParse } from '../../safeJson';
import type { BlockerSeverity } from './publishGate';
import { severityForWeakness } from './publishGate';

export type CategoryScore = {
  score: number;
  pros: string[];
  cons: string[];
  /** 0–1 Judge confidence (optional) */
  confidence?: number;
};

export type WeaknessItem = {
  text: string;
  severity: BlockerSeverity;
};

export type RewriteAction = {
  section: string;
  action: string;
  reason: string;
  expected_gain: string;
};

export type EditorialJudgeResult = {
  categories: {
    narrative: CategoryScore;
    reader_experience: CategoryScore;
    expert_voice: CategoryScore;
    information_gain: CategoryScore;
    trust: CategoryScore;
    examples: CategoryScore;
  };
  weaknesses: string[];
  weakness_items: WeaknessItem[];
  recommended_rewrites: string[];
  recommended_actions: RewriteAction[];
  vs_top5: {
    better: string[];
    worse: string[];
    overall: 'wins' | 'ties' | 'loses';
  };
  lead_encourages: number;
  sounds_expert: number;
  answers_intent: number;
  better_than_top5: number;
  /** 0–10: does reader know what to DO after reading? */
  root_intent_coverage: number;
  /** Optional commentary only — never overrides heuristic benchmark */
  feature_winners?: Partial<Record<'opening' | 'narrative' | 'examples' | 'eeat' | 'cta', string>>;
};

export type EditorialJudgeStatus =
  | { status: 'ok'; result: EditorialJudgeResult; tokens: number }
  | { status: 'skipped'; reason: string }
  | { status: 'skipped_error'; reason: string };

const SYSTEM = [
  'You are an editorial reviewer for Ranksmile Writing Intelligence.',
  'You evaluate finished articles — you do NOT rewrite them.',
  'Return ONLY valid JSON matching the schema. No markdown fences.',
  'Scores are integers 0–10. Pros/cons are short bullet phrases in the article language or English.',
  'Add confidence 0–1 per category when unsure.',
  'vs_top5.overall must be "ties" if AO wins some features but loses opening or EEAT — never claim full wins on a split.',
  'Flag placeholders, Last Updated leaks, encyclopedic leads, and missing action path (root_intent_coverage).',
  'recommended_actions: array of {section, action, reason, expected_gain}.',
  'weakness_items: array of {text, severity: critical|high|medium|low}.',
].join(' ');

function emptyCat(score = 5): CategoryScore {
  return { score, pros: [], cons: [], confidence: 0.7 };
}

function clamp10(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 5;
  return Math.max(0, Math.min(10, Math.round(v)));
}

function clamp01(n: unknown): number | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(1, n));
}

function asStringArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 12);
}

function parseSeverity(raw: unknown): BlockerSeverity {
  if (raw === 'critical' || raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return 'medium';
}

function parseCategory(raw: unknown): CategoryScore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyCat();
  const o = raw as Record<string, unknown>;
  const confidence = clamp01(o.confidence);
  return {
    score: clamp10(o.score),
    pros: asStringArr(o.pros),
    cons: asStringArr(o.cons),
    ...(confidence != null ? { confidence } : { confidence: 0.75 }),
  };
}

function parseWeaknessItems(raw: unknown, fallbackTexts: string[]): WeaknessItem[] {
  if (Array.isArray(raw)) {
    const out: WeaknessItem[] = [];
    for (const item of raw) {
      if (typeof item === 'string') {
        out.push({ text: item.trim(), severity: severityForWeakness(item) });
      } else if (item && typeof item === 'object' && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        const text = typeof o.text === 'string' ? o.text.trim() : '';
        if (!text) continue;
        out.push({ text, severity: parseSeverity(o.severity) });
      }
    }
    if (out.length) return out.slice(0, 12);
  }
  return fallbackTexts.map((text) => ({ text, severity: severityForWeakness(text) }));
}

function parseRewriteActions(raw: unknown, fallback: string[]): RewriteAction[] {
  if (Array.isArray(raw)) {
    const out: RewriteAction[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const o = item as Record<string, unknown>;
      const section = typeof o.section === 'string' ? o.section.trim() : '';
      const action = typeof o.action === 'string' ? o.action.trim() : '';
      if (!section && !action) continue;
      out.push({
        section: section || 'General',
        action: action || String(o.rewrite || ''),
        reason: typeof o.reason === 'string' ? o.reason.trim() : '',
        expected_gain: typeof o.expected_gain === 'string' ? o.expected_gain.trim() : '',
      });
    }
    if (out.length) return out.slice(0, 10);
  }
  return fallback.map((line) => ({
    section: 'General',
    action: line,
    reason: '',
    expected_gain: '',
  }));
}

/** Normalize/repair LLM JSON into EditorialJudgeResult. */
export function parseEditorialJudgeResult(raw: unknown): EditorialJudgeResult {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? raw as Record<string, unknown>
    : {};
  const cats = (o.categories && typeof o.categories === 'object' && !Array.isArray(o.categories))
    ? o.categories as Record<string, unknown>
    : {};
  const vs = (o.vs_top5 && typeof o.vs_top5 === 'object' && !Array.isArray(o.vs_top5))
    ? o.vs_top5 as Record<string, unknown>
    : {};
  const overallRaw = vs.overall;
  let overall: 'wins' | 'ties' | 'loses' =
    overallRaw === 'wins' || overallRaw === 'ties' || overallRaw === 'loses'
      ? overallRaw
      : 'ties';
  // Soften: if Judge lists worse features including opening/eeat, don't allow full wins
  const worse = asStringArr(vs.worse);
  if (overall === 'wins' && worse.some((w) => /opening|lead|eeat|cta/i.test(w))) {
    overall = 'ties';
  }

  const weaknesses = asStringArr(o.weaknesses);
  const recommended_rewrites = asStringArr(o.recommended_rewrites);

  return {
    categories: {
      narrative: parseCategory(cats.narrative),
      reader_experience: parseCategory(cats.reader_experience),
      expert_voice: parseCategory(cats.expert_voice),
      information_gain: parseCategory(cats.information_gain),
      trust: parseCategory(cats.trust),
      examples: parseCategory(cats.examples),
    },
    weaknesses,
    weakness_items: parseWeaknessItems(o.weakness_items, weaknesses),
    recommended_rewrites,
    recommended_actions: parseRewriteActions(o.recommended_actions, recommended_rewrites),
    vs_top5: {
      better: asStringArr(vs.better),
      worse,
      overall,
    },
    lead_encourages: clamp10(o.lead_encourages),
    sounds_expert: clamp10(o.sounds_expert),
    answers_intent: clamp10(o.answers_intent),
    better_than_top5: clamp10(o.better_than_top5),
    root_intent_coverage: clamp10(o.root_intent_coverage ?? o.answers_intent),
    feature_winners:
      o.feature_winners && typeof o.feature_winners === 'object' && !Array.isArray(o.feature_winners)
        ? (o.feature_winners as EditorialJudgeResult['feature_winners'])
        : undefined,
  };
}

export function buildEditorialJudgeUserPrompt(opts: {
  keyword: string;
  articleExcerpt: string;
  readerBrief?: string;
  synthesisSummary?: string;
  policySummary?: string;
  competitorExcerpts?: Array<{ label: string; text: string }>;
}): string {
  const comps = (opts.competitorExcerpts || [])
    .slice(0, 5)
    .map((c) => `### ${c.label}\n${c.text.slice(0, 1500)}`)
    .join('\n\n');

  return [
    `Keyword: ${opts.keyword}`,
    opts.readerBrief ? `Reader:\n${opts.readerBrief}` : '',
    opts.synthesisSummary ? `Competitor synthesis (brief):\n${opts.synthesisSummary}` : '',
    opts.policySummary ? `WIE policy decisions:\n${opts.policySummary}` : '',
    '',
    '## AO article (excerpt)',
    opts.articleExcerpt.slice(0, 8000),
    '',
    comps ? `## Top competitors (excerpts)\n${comps}` : '## Top competitors\n(none provided)',
    '',
    'Return JSON with keys: categories{narrative,reader_experience,expert_voice,information_gain,trust,examples},',
    'each {score,pros[],cons[],confidence?}; weakness_items[{text,severity}]; recommended_actions[{section,action,reason,expected_gain}];',
    'vs_top5{better[],worse[],overall:"wins"|"ties"|"loses"} — use ties if AO lost opening or EEAT;',
    'lead_encourages,sounds_expert,answers_intent,better_than_top5,root_intent_coverage (0-10);',
    'optional feature_winners (commentary only, do not invent winners that contradict scores).',
  ].filter(Boolean).join('\n');
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

/**
 * Call LLM Editorial Judge. Injectable llmComplete for tests.
 */
export async function runEditorialJudge(opts: {
  keyword: string;
  articleExcerpt: string;
  readerBrief?: string;
  synthesisSummary?: string;
  policySummary?: string;
  competitorExcerpts?: Array<{ label: string; text: string }>;
  skip?: boolean;
  llmComplete?: (system: string, user: string) => Promise<{ text: string; tokens: number }>;
}): Promise<EditorialJudgeStatus> {
  if (opts.skip) return { status: 'skipped', reason: 'skip_judge' };

  const user = buildEditorialJudgeUserPrompt(opts);

  try {
    let text: string;
    let tokens = 0;
    if (opts.llmComplete) {
      const r = await opts.llmComplete(SYSTEM, user);
      text = r.text;
      tokens = r.tokens;
    } else {
      const { chatLlm } = await import('../../ai/deepseek');
      type Llm = ReturnType<typeof chatLlm>;
      const tryOnce = async (llm: Llm) => {
        if (!llm.apiKey) return { ok: false as const, status: 0, reason: `${llm.keyEnv}_missing` };
        const aiRes = await fetch(llm.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llm.apiKey}` },
          body: JSON.stringify({
            model: llm.model,
            max_tokens: 2500,
            temperature: 0.15,
            messages: [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: user },
            ],
          }),
        });
        if (!aiRes.ok) return { ok: false as const, status: aiRes.status, reason: `http_${aiRes.status}` };
        const data = await aiRes.json() as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { total_tokens?: number };
        };
        return {
          ok: true as const,
          text: data?.choices?.[0]?.message?.content || '',
          tokens: typeof data?.usage?.total_tokens === 'number' ? data.usage.total_tokens : 0,
        };
      };

      let llm = chatLlm();
      let res = await tryOnce(llm);
      // Gemini OpenAI-compat may 404 (retired model) / 429 — Judge falls back to DeepSeek.
      if (!res.ok && llm.provider === 'gemini' && process.env.DEEPSEEK_API_KEY) {
        llm = {
          provider: 'deepseek',
          apiKey: process.env.DEEPSEEK_API_KEY,
          keyEnv: 'DEEPSEEK_API_KEY',
          model: 'deepseek-chat',
          url: 'https://api.deepseek.com/v1/chat/completions',
        };
        res = await tryOnce(llm);
      }
      if (!res.ok) return { status: 'skipped_error', reason: res.reason };
      text = res.text;
      tokens = res.tokens;
    }

    const parsed = safeJsonParse<unknown>(stripFences(text), null);
    if (parsed == null) return { status: 'skipped_error', reason: 'invalid_json' };
    return { status: 'ok', result: parseEditorialJudgeResult(parsed), tokens };
  } catch (e) {
    return {
      status: 'skipped_error',
      reason: e instanceof Error ? e.message : 'judge_failed',
    };
  }
}

/** Code-review markdown for one category. */
export function formatCategoryReview(name: string, cat: CategoryScore): string {
  const conf = cat.confidence != null ? ` · conf ${Math.round(cat.confidence * 100)}%` : '';
  const lines = [`### ${name} — ${cat.score}/10${conf}`];
  for (const p of cat.pros) lines.push(`✓ ${p}`);
  for (const c of cat.cons) lines.push(`✗ ${c}`);
  if (!cat.pros.length && !cat.cons.length) lines.push('_No bullets_');
  return lines.join('\n');
}

export function formatEditorialReviewMarkdown(r: EditorialJudgeResult): string {
  const c = r.categories;
  return [
    formatCategoryReview('Narrative', c.narrative),
    '',
    formatCategoryReview('Reader Experience', c.reader_experience),
    '',
    formatCategoryReview('Expert Voice', c.expert_voice),
    '',
    formatCategoryReview('Information Gain', c.information_gain),
    '',
    formatCategoryReview('Trust', c.trust),
    '',
    formatCategoryReview('Examples', c.examples),
    '',
    '### Headline questions',
    `- Lead encourages? **${r.lead_encourages}/10**`,
    `- Sounds expert? **${r.sounds_expert}/10**`,
    `- Answers intent? **${r.answers_intent}/10**`,
    `- Root Intent Coverage (knows what to do)? **${r.root_intent_coverage}/10**`,
    `- Better than Top5? **${r.better_than_top5}/10** (${r.vs_top5.overall})`,
  ].join('\n');
}

export function formatRewriteActionsMarkdown(actions: RewriteAction[]): string {
  if (!actions.length) return '';
  const lines = [
    '## Recommended rewrites',
    '',
    '| Section | Action | Reason | Expected gain |',
    '| --- | --- | --- | --- |',
  ];
  for (const a of actions) {
    lines.push(
      `| ${a.section || '—'} | ${a.action || '—'} | ${a.reason || '—'} | ${a.expected_gain || '—'} |`,
    );
  }
  return lines.join('\n');
}

export function formatWeaknessItemsMarkdown(items: WeaknessItem[]): string {
  if (!items.length) return '';
  const lines = ['## Weaknesses', '', '| Severity | Issue |', '| --- | --- |'];
  for (const w of items) {
    lines.push(`| ${w.severity} | ${w.text} |`);
  }
  return lines.join('\n');
}

export { SYSTEM as EDITORIAL_JUDGE_SYSTEM };
