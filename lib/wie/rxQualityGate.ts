/**
 * WIE Layer 3 — lightweight RX / EEAT veto after score gates accept.
 * Heuristic only (Filar A) — no second LLM round-trip required.
 */
import type { CompetitorSynthesis } from './competitorSynthesis';
import { scoreEeat, EEAT_SOFT_FLOOR } from './eeatScore';

export type RxGateResult =
  | { ok: true }
  | { ok: false; reason: string; detail: string };

const EDITOR_PLACEHOLDER_RE = /\[Editor:|TODO:\s*add\s+authoritative|dodaj\s+2-3\s+autorytatywne/i;
const EXPERT_MARKER_RE = /w praktyce|najczęściej|z doświadczenia|w większości|in practice|typically|from our|nasze biuro|nasz zespół/i;
const DEFINITION_HEAVY_RE = /definicja|słownik|oznacza to|is defined as|to zmuszanie|to przestępstwo polegające/i;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function paragraphLengths(html: string): number[] {
  const ps = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
  return ps.map((p) => stripTags(p).split(/\s+/).filter(Boolean).length).filter((n) => n > 0);
}

/** Coefficient of variation of paragraph word counts; low = robotic uniformity. */
function paragraphCv(lens: number[]): number {
  if (lens.length < 3) return 1;
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  if (mean < 1) return 1;
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
  return Math.sqrt(variance) / mean;
}

function hasConcreteExample(text: string, synthesis: CompetitorSynthesis | null | undefined): boolean {
  if (synthesis?.examples?.some((ex) => text.toLowerCase().includes(ex.toLowerCase()))) return true;
  return /\b(np\.|np:|na przykład|for example|Messenger|WhatsApp|Bitcoin|e-mail|email|HR|LinkedIn)\b/i.test(text);
}

const PRACTICAL_ACTIONS = new Set([
  'improve_direct_answer',
  'expand_section',
  'expand_existing_paragraph',
  'rewrite_section',
  'add_missing_section',
  'add_facts',
]);

/**
 * Reject Wikipedia-checklist / placeholder edits even when SEO/AI score rose.
 */
export function evaluateRxQualityGate(opts: {
  afterHtml: string;
  action: string;
  synthesis?: CompetitorSynthesis | null;
}): RxGateResult {
  const html = opts.afterHtml || '';
  const plain = stripTags(html);

  if (EDITOR_PLACEHOLDER_RE.test(html) || EDITOR_PLACEHOLDER_RE.test(plain)) {
    return { ok: false, reason: 'placeholder', detail: 'editor placeholder in content' };
  }

  const practical = PRACTICAL_ACTIONS.has(opts.action);
  if (practical && DEFINITION_HEAVY_RE.test(plain) && !hasConcreteExample(plain, opts.synthesis)) {
    // Only veto when the edit is long enough to have included an example
    if (plain.split(/\s+/).length >= 80) {
      return { ok: false, reason: 'no_example', detail: 'practical section lacks concrete example' };
    }
  }

  const lens = paragraphLengths(html);
  if (lens.length >= 4 && paragraphCv(lens) < 0.12) {
    const allMid = lens.every((n) => n >= 55 && n <= 85);
    if (allMid) {
      return { ok: false, reason: 'uniform_paragraphs', detail: `cv=${paragraphCv(lens).toFixed(3)}` };
    }
  }

  if (
    opts.synthesis?.expert_claims?.length
    && practical
    && plain.split(/\s+/).length >= 100
    && !EXPERT_MARKER_RE.test(plain)
  ) {
    return { ok: false, reason: 'no_expert_voice', detail: 'missing expert markers despite synthesis claims' };
  }

  // Information Gain: practical rewrite that only restates critical labels without new detail
  if (
    practical
    && opts.synthesis?.critical?.length
    && plain.split(/\s+/).length >= 90
  ) {
    const criticalHits = opts.synthesis.critical.filter((c) =>
      plain.toLowerCase().includes(c.toLowerCase().slice(0, Math.min(40, c.length))),
    ).length;
    const hasGain =
      hasConcreteExample(plain, opts.synthesis)
      || EXPERT_MARKER_RE.test(plain)
      || /\b(art\.|§|krok|zrób|nie płać|zgłoś|zbierz)\b/i.test(plain);
    if (criticalHits >= 2 && !hasGain) {
      return {
        ok: false,
        reason: 'low_information_gain',
        detail: 'covers critical labels without new actionable detail',
      };
    }
  }

  const eeat = scoreEeat(html);
  if (eeat.reasons.includes('fake_credentials_penalty')) {
    return { ok: false, reason: 'fake_credentials', detail: 'invented credentials / guarantees' };
  }
  if (practical && plain.split(/\s+/).length >= 100 && eeat.score < EEAT_SOFT_FLOOR) {
    return {
      ok: false,
      reason: 'eeat_below_floor',
      detail: `eeat=${eeat.score} < ${EEAT_SOFT_FLOOR}`,
    };
  }

  return { ok: true };
}
