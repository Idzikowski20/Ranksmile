/**
 * WIE Layer 3 — lightweight RX / EEAT veto after score gates accept.
 * Heuristic only (Filar A) — no second LLM round-trip required.
 */
import type { CompetitorSynthesis } from '@/src/infrastructure/wie/competitorSynthesis';
import { scoreEeat, EEAT_SOFT_FLOOR } from '@/src/core/domain/wie/eeatScore';

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

type RxFailure = { reason: string; detail: string };

/**
 * Reject Wikipedia-checklist / placeholder edits even when SEO/AI score rose.
 *
 * Every check reads the whole document, so with `beforeHtml` the verdict is a
 * regression check: only a failure the before-state did not already have counts.
 * An article that never carried an expert marker vetoed each of its own edits on
 * "no_expert_voice" — 8 of 11 sections in one 13-section run.
 */
export function evaluateRxQualityGate(opts: {
  afterHtml: string;
  beforeHtml?: string;
  action: string;
  synthesis?: CompetitorSynthesis | null;
}): RxGateResult {
  const after = failures(opts.afterHtml, opts.action, opts.synthesis);
  if (!after.length) return { ok: true };
  if (opts.beforeHtml == null) return { ok: false, ...after[0] };
  const inherited = new Set(failures(opts.beforeHtml, opts.action, opts.synthesis).map((f) => f.reason));
  const introduced = after.find((f) => !inherited.has(f.reason));
  return introduced ? { ok: false, ...introduced } : { ok: true };
}

/** Every check the document fails, independently — order is severity. */
function failures(
  afterHtml: string,
  action: string,
  synthesis: CompetitorSynthesis | null | undefined,
): RxFailure[] {
  const out: RxFailure[] = [];
  const html = afterHtml || '';
  const plain = stripTags(html);
  const wordCount = plain.split(/\s+/).length;
  const practical = PRACTICAL_ACTIONS.has(action);

  if (EDITOR_PLACEHOLDER_RE.test(html) || EDITOR_PLACEHOLDER_RE.test(plain)) {
    out.push({ reason: 'placeholder', detail: 'editor placeholder in content' });
  }

  // Only veto when the edit is long enough to have included an example
  if (practical && DEFINITION_HEAVY_RE.test(plain) && !hasConcreteExample(plain, synthesis) && wordCount >= 80) {
    out.push({ reason: 'no_example', detail: 'practical section lacks concrete example' });
  }

  const lens = paragraphLengths(html);
  if (lens.length >= 4 && paragraphCv(lens) < 0.12 && lens.every((n) => n >= 55 && n <= 85)) {
    out.push({ reason: 'uniform_paragraphs', detail: `cv=${paragraphCv(lens).toFixed(3)}` });
  }

  if (synthesis?.expert_claims?.length && practical && wordCount >= 100 && !EXPERT_MARKER_RE.test(plain)) {
    out.push({ reason: 'no_expert_voice', detail: 'missing expert markers despite synthesis claims' });
  }

  // Information Gain: practical rewrite that only restates critical labels without new detail
  if (practical && synthesis?.critical?.length && wordCount >= 90) {
    const criticalHits = synthesis.critical.filter((c) =>
      plain.toLowerCase().includes(c.toLowerCase().slice(0, Math.min(40, c.length))),
    ).length;
    const hasGain = hasConcreteExample(plain, synthesis)
      || EXPERT_MARKER_RE.test(plain)
      || /\b(art\.|§|krok|zrób|nie płać|zgłoś|zbierz)\b/i.test(plain);
    if (criticalHits >= 2 && !hasGain) {
      out.push({ reason: 'low_information_gain', detail: 'covers critical labels without new actionable detail' });
    }
  }

  const eeat = scoreEeat(html);
  if (eeat.reasons.includes('fake_credentials_penalty')) {
    out.push({ reason: 'fake_credentials', detail: 'invented credentials / guarantees' });
  }
  if (practical && wordCount >= 100 && eeat.score < EEAT_SOFT_FLOOR) {
    out.push({ reason: 'eeat_below_floor', detail: `eeat=${eeat.score} < ${EEAT_SOFT_FLOOR}` });
  }

  return out;
}
