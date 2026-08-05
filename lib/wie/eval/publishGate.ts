/**
 * Publish readiness gate + article hygiene heuristics for WIE eval.
 */
import type { ExplainabilityRecord } from '../explainability';
import { detectOpeningStyle } from './policyCompliance';

export type BlockerSeverity = 'critical' | 'high' | 'medium' | 'low';

export type PublishBlocker = {
  id: string;
  severity: BlockerSeverity;
  reason: string;
};

export type PublishGateResult = {
  ready: boolean;
  decision: 'READY' | 'NOT READY';
  blockers: PublishBlocker[];
};

export type RootIntentCoverage = {
  score: number; // 0–10
  has_action_steps: boolean;
  answers_what_to_do: boolean;
  note: string;
};

const PLACEHOLDER_RE = /Editor:\s*dodaj|\[placeholder\]|TODO:|FIXME|\{\{[^}]+\}\}/i;
const LAST_UPDATED_RE = /Last\s*Updated|Ostatnia\s+aktualizacja/i;
const WIKI_LEAD_RE = /^(?:<h1[^>]*>[^<]*<\/h1>\s*)?(?:<p[^>]*>)?\s*[A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż][^.!?]{0,80}\s+(?:to|jest|oznacza)\b/i;
const ACTION_STEPS_RE = /(?:^|\n)\s*(?:1[\.\)]|krok\s*1|co\s+robić|nie\s+płać|zgłoś|zachowaj\s+dowody)/im;
const WHAT_TO_DO_RE = /co\s+(?:zrobić|robić)|jak\s+się\s+zachować|plan\s+działań/i;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function longParagraphCount(html: string, wordThreshold = 280): number {
  const paras = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
  let n = 0;
  for (const p of paras) {
    const words = stripTags(p).split(/\s+/).filter(Boolean).length;
    if (words >= wordThreshold) n += 1;
  }
  return n;
}

export type PublishGateOpts = {
  expectedOpening?: string | null;
  explainability?: ExplainabilityRecord[];
};

/** Heuristic blockers that should fail publish. */
export function detectPublishBlockers(html: string, opts?: PublishGateOpts): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];
  const plain = stripTags(html);

  if (PLACEHOLDER_RE.test(html) || PLACEHOLDER_RE.test(plain)) {
    blockers.push({
      id: 'placeholder',
      severity: 'critical',
      reason: 'Editor/placeholder markers still in HTML (e.g. “Editor: dodaj link”)',
    });
  }
  if (LAST_UPDATED_RE.test(html) || LAST_UPDATED_RE.test(plain)) {
    blockers.push({
      id: 'last_updated',
      severity: 'critical',
      reason: '“Last Updated” / meta timestamp leaked into article body',
    });
  }

  const expectedOpening = opts?.expectedOpening
    ?? opts?.explainability?.find((e) => e.decision.startsWith('opening:'))?.decision.split(':')[1];

  if (expectedOpening === 'problem_first') {
    const obs = detectOpeningStyle(html);
    if (obs !== 'problem_first') {
      blockers.push({
        id: 'opening_policy_violation',
        severity: 'critical',
        reason: `WIE expected problem_first but observed ${obs} — Writer/AO failed policy`,
      });
    }
  } else {
    const lead = plain.slice(0, 280);
    if (WIKI_LEAD_RE.test(html) || /^(?:\S+\s+){0,6}to (?:forma|przestępstwo|definicja|pojęcie)/i.test(lead)) {
      blockers.push({
        id: 'encyclopedic_lead',
        severity: 'high',
        reason: 'Lead reads like a dictionary/Wikipedia definition, not problem-first',
      });
    }
  }

  const longN = longParagraphCount(html);
  if (longN >= 2) {
    blockers.push({
      id: 'long_paragraphs',
      severity: 'medium',
      reason: `${longN} paragraphs ≥280 words — hurts Reader Experience`,
    });
  }
  const h2s = (html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [])
    .map((h) => stripTags(h).toLowerCase());
  const seen = new Set<string>();
  for (const t of h2s) {
    if (!t) continue;
    if (seen.has(t)) {
      blockers.push({
        id: 'duplicate_headings',
        severity: 'medium',
        reason: `Duplicate H2: “${t.slice(0, 60)}”`,
      });
      break;
    }
    seen.add(t);
  }

  return blockers;
}

export function evaluatePublishGate(html: string, opts?: PublishGateOpts): PublishGateResult {
  const blockers = detectPublishBlockers(html, opts);
  const blocked = blockers.some((b) => b.severity === 'critical' || b.severity === 'high');
  return {
    ready: !blocked,
    decision: blocked ? 'NOT READY' : 'READY',
    blockers,
  };
}

/** Root Intent: does the reader know what to DO (not only what the topic is)? */
export function scoreRootIntentCoverage(html: string): RootIntentCoverage {
  const plain = stripTags(html);
  const has_action_steps = ACTION_STEPS_RE.test(html) || ACTION_STEPS_RE.test(plain);
  const answers_what_to_do = WHAT_TO_DO_RE.test(plain);
  let score = 3;
  if (answers_what_to_do) score += 3;
  if (has_action_steps) score += 3;
  if (/nie\s+płać|nie\s+przelewaj|zachowaj\s+dowody|zgło[sś]/i.test(plain)) score += 1;
  score = Math.max(0, Math.min(10, score));
  const note = !answers_what_to_do
    ? 'Topic coverage without a clear “what should I do” path'
    : !has_action_steps
      ? 'Mentions what to do but lacks concrete numbered steps'
      : 'Reader can extract an action path';
  return { score, has_action_steps, answers_what_to_do, note };
}

/** Attach severity to free-text weaknesses (heuristic). */
export function severityForWeakness(text: string): BlockerSeverity {
  const t = text.toLowerCase();
  if (/placeholder|last updated|editor:|publish|broken link|opening_policy/.test(t)) return 'critical';
  if (/opening|lead|encyklop|wikipedia|definicj|eeat|cta|intent/.test(t)) return 'high';
  if (/example|faq|paragraph|powtórz|duplicate|link/.test(t)) return 'medium';
  return 'low';
}

export function formatPublishGateMarkdown(g: PublishGateResult): string {
  const lines = [
    '## Publishing Decision',
    '',
    g.decision === 'READY' ? '✅ **READY**' : '❌ **NOT READY**',
    '',
  ];
  if (g.blockers.length) {
    lines.push('| Severity | Issue |', '| --- | --- |');
    for (const b of g.blockers) {
      lines.push(`| ${b.severity} | ${b.reason} |`);
    }
  } else {
    lines.push('_No blockers detected._');
  }
  return lines.join('\n');
}
