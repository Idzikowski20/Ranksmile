/**
 * WIE Layer 2 — Narrative Planner.
 * Arc: problem → explain → example → action (+ optional FAQ).
 */
import type { CompetitorSynthesis } from './competitorSynthesis';
import type { ReaderBrief } from './readerBrief';
import type { PolicyBundle } from './policyResolver';

export type NarrativeBeat = {
  role: 'problem' | 'explain' | 'example' | 'action' | 'faq' | 'cta';
  goal: string;
};

export type NarrativePlan = {
  openingMove: 'problem_first' | 'definition_first';
  beats: NarrativeBeat[];
  ctaPlacement: 'last_10_percent' | 'soft_inline' | 'none';
  reason: string;
};

const DEFAULT_BEATS: NarrativeBeat[] = [
  { role: 'problem', goal: 'Name the reader situation and stakes in plain language.' },
  { role: 'explain', goal: 'Clarify what is happening and why it matters (no dictionary dump).' },
  { role: 'example', goal: 'Give one concrete scenario the reader recognizes.' },
  { role: 'action', goal: 'List clear next steps the reader can take now.' },
];

function mapSectionPattern(s: string): NarrativeBeat['role'] | null {
  const t = s.toLowerCase();
  if (/faq|pytan/.test(t)) return 'faq';
  if (/example|przykład|case|historia|story/.test(t)) return 'example';
  if (/krok|step|checklist|co robić|action|rozwiąz/.test(t)) return 'action';
  if (/problem|ofiar|skutek|konsekwenc|risk/.test(t)) return 'problem';
  if (/definic|wyjaśn|czym jest|explain|prawo|art\./.test(t)) return 'explain';
  return null;
}

/** Build narrative arc from ReaderBrief + Policy opening + Synthesis shapes. */
export function buildNarrativePlan(opts: {
  readerBrief?: ReaderBrief | null;
  policy?: PolicyBundle | null;
  synthesis?: CompetitorSynthesis | null;
}): NarrativePlan {
  const openingDec = opts.policy?.decisions.find((d) => d.id === 'opening');
  const openingMove: NarrativePlan['openingMove'] =
    openingDec?.value === 'definition_first'
    || (!openingDec && opts.synthesis?.opening_style?.definition_first && !opts.synthesis.opening_style.problem_first)
      ? 'definition_first'
      : 'problem_first';

  const beats: NarrativeBeat[] = [];
  const seen = new Set<string>();
  const push = (b: NarrativeBeat) => {
    if (seen.has(b.role)) return;
    seen.add(b.role);
    beats.push(b);
  };

  if (openingMove === 'definition_first') {
    push({ role: 'explain', goal: 'Lead with a precise definition, then why the reader cares.' });
    push({ role: 'problem', goal: 'Connect definition to the reader problem.' });
  } else {
    push(DEFAULT_BEATS[0]);
    push(DEFAULT_BEATS[1]);
  }

  for (const sp of opts.synthesis?.section_patterns || []) {
    const role = mapSectionPattern(sp);
    if (!role || role === 'faq') continue;
    const def = DEFAULT_BEATS.find((d) => d.role === role);
    push(def || { role, goal: `Cover “${sp}” in narrative order.` });
  }

  if ((opts.synthesis?.examples?.length || 0) > 0 || opts.policy?.decisions.some((d) => d.id === 'examples_min')) {
    push(DEFAULT_BEATS[2]);
  }
  push(DEFAULT_BEATS[3]);

  const faqKeys = Object.keys(opts.synthesis?.faq || {});
  if (faqKeys.length || (opts.synthesis?.section_patterns || []).some((s) => /faq|pytan/i.test(s))) {
    push({ role: 'faq', goal: 'Answer secondary intents in a short FAQ — no duplicates.' });
  }

  const emotion = opts.readerBrief?.emotion || 'medium';
  const ctaPlacement: NarrativePlan['ctaPlacement'] =
    emotion === 'high' ? 'last_10_percent' : emotion === 'low' ? 'none' : 'soft_inline';
  if (ctaPlacement !== 'none') {
    push({
      role: 'cta',
      goal: ctaPlacement === 'last_10_percent'
        ? 'End with a soft, concrete next step (no hard sell).'
        : 'Offer a gentle next step where natural.',
    });
  }

  return {
    openingMove,
    beats,
    ctaPlacement,
    reason: `Arc from ${openingMove}; emotion=${emotion}; synth_patterns=${(opts.synthesis?.section_patterns || []).length}`,
  };
}

export function formatNarrativePlanForPrompt(plan: NarrativePlan | null | undefined): string {
  if (!plan?.beats.length) return '';
  const lines = [
    'NARRATIVE (Writing Intelligence — keep article flow):',
    `- Opening move: ${plan.openingMove}`,
    `- CTA: ${plan.ctaPlacement}`,
    '- Beats (prefer this order across the article; do not turn every H2 into a mini-encyclopedia):',
  ];
  for (const b of plan.beats) {
    lines.push(`  • ${b.role}: ${b.goal}`);
  }
  lines.push(`- ${plan.reason}`);
  return lines.join('\n');
}
