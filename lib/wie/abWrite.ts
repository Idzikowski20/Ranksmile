/**
 * WIE Layer 3 — A/B Write: score two section variants, pick winner.
 * Same gates/policies as Writer; selection is explainable.
 */
import type { CompetitorSynthesis } from './competitorSynthesis';
import { evaluateRxQualityGate } from './rxQualityGate';
import { scoreEeat } from './eeatScore';
import type { AoScores } from '../ao/aoScoreDelta';

export type AbVariantLabel = 'A' | 'B';

export type AbVariantScore = {
  label: AbVariantLabel;
  html: string;
  scores: AoScores;
  rxOk: boolean;
  rxReason?: string;
  /** Higher is better — combines score delta + RX heuristics */
  quality: number;
};

const EXPERT_RE = /w praktyce|najczęściej|z doświadczenia|w większości|in practice|typically/i;
const EXAMPLE_RE = /\b(np\.|na przykład|for example|Messenger|WhatsApp|Bitcoin|e-mail|email)\b/i;
const YOU_RE = /\b(Ty|Tobie|Twój|you|your)\b/i;
const DEF_RE = /definicja|słownik|oznacza to|is defined as/i;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function paragraphCv(html: string): number {
  const ps = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
  const lens = ps.map((p) => stripTags(p).split(/\s+/).filter(Boolean).length).filter((n) => n > 0);
  if (lens.length < 3) return 0.5;
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  if (mean < 1) return 0.5;
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
  return Math.min(1, Math.sqrt(variance) / mean);
}

/** Soft RX quality 0–40 (does not replace hard veto). */
export function scoreRxHeuristics(html: string, synthesis?: CompetitorSynthesis | null): number {
  const plain = stripTags(html);
  let s = 10;
  if (EXAMPLE_RE.test(plain) || synthesis?.examples?.some((e) => plain.toLowerCase().includes(e.toLowerCase()))) {
    s += 10;
  }
  if (EXPERT_RE.test(plain)) s += 8;
  if (YOU_RE.test(plain)) s += 5;
  if (DEF_RE.test(plain) && !EXAMPLE_RE.test(plain)) s -= 8;
  s += Math.round(paragraphCv(html) * 10);
  return Math.max(0, Math.min(40, s));
}

export function scoreAbVariant(opts: {
  label: AbVariantLabel;
  sectionHtml: string;
  scores: AoScores;
  working: AoScores;
  action: string;
  synthesis?: CompetitorSynthesis | null;
}): AbVariantScore {
  const rx = evaluateRxQualityGate({
    afterHtml: opts.sectionHtml,
    action: opts.action,
    synthesis: opts.synthesis,
  });
  const delta =
    (opts.scores.content - opts.working.content)
    + 0.5 * (opts.scores.seo - opts.working.seo)
    + 0.5 * (opts.scores.ai - opts.working.ai);
  const rxH = scoreRxHeuristics(opts.sectionHtml, opts.synthesis);
  const eeat = scoreEeat(opts.sectionHtml);
  const quality = (rx.ok ? 20 : -50) + rxH + delta * 2 + (eeat.score - 50) * 0.15;
  return {
    label: opts.label,
    html: opts.sectionHtml,
    scores: opts.scores,
    rxOk: rx.ok,
    rxReason: rx.ok ? undefined : rx.reason,
    quality,
  };
}

export function pickAbWinner(a: AbVariantScore, b: AbVariantScore): {
  winner: AbVariantScore;
  loser: AbVariantScore;
  margin: number;
} {
  // Prefer RX-ok; then quality
  const prefer = (x: AbVariantScore, y: AbVariantScore) => {
    if (x.rxOk && !y.rxOk) return x;
    if (y.rxOk && !x.rxOk) return y;
    return x.quality >= y.quality ? x : y;
  };
  const winner = prefer(a, b);
  const loser = winner.label === 'A' ? b : a;
  return { winner, loser, margin: winner.quality - loser.quality };
}

/** First N practical steps only — token budget. */
export function shouldAbWriteStep(opts: {
  action: string;
  stepIndex: number;
  abBudgetLeft: number;
}): boolean {
  if (opts.abBudgetLeft <= 0) return false;
  if (opts.stepIndex > 3) return false;
  const practical = new Set([
    'improve_direct_answer',
    'expand_section',
    'expand_existing_paragraph',
    'rewrite_section',
    'add_missing_section',
  ]);
  return practical.has(opts.action);
}

/** Variant B nudge — alternate narrative without dumping a second policy blob. */
export function abVariantBHint(opening?: string): string {
  if (opening === 'definition_first') {
    return 'VARIANT B: Open with a concrete reader scenario/example first, then the technical definition.';
  }
  return 'VARIANT B: Lead with one concrete example or mini-scenario in the first paragraph; keep the objective; vary paragraph length.';
}
