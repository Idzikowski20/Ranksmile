/**
 * Format Content Planner bundle into WIE / Writer prompt blocks.
 */
import type { ContentPlannerBundle } from './types';

export function formatContentPlannerForPrompt(bundle: ContentPlannerBundle | null | undefined): string {
  if (!bundle) return '';
  const lines = [
    'CONTENT PLANNER V2 (follow budgets + assigned knowledge; do not invent brand niche):',
    `Reader: ${bundle.reader.readerPersona} | ${bundle.reader.goal} | tone=${bundle.reader.tone}`,
    `CTA: ${bundle.reader.expectedCta}`,
    `Blueprint: words=${bundle.blueprint.targetWords} H2=${bundle.blueprint.targetH2} claims=${bundle.blueprint.targetClaims} questions=${bundle.blueprint.targetQuestions} freshness=${bundle.blueprint.freshness}`,
    `Required sections: ${bundle.blueprint.requiredSections.join(', ')}`,
    `Benchmark: avgWords=${bundle.benchmark.averageWords} targetWords=${bundle.benchmark.targetWords} avgH2=${bundle.benchmark.averageH2}`,
  ];
  if (bundle.outline?.sections.length) {
    lines.push('Outline:');
    for (const s of bundle.outline.sections.slice(0, 20)) {
      lines.push(
        `  • [${s.importance}] ${s.heading} — words~${s.expectedWords}; blocks=${s.requiredBlocks.join('+')}; claims=${s.assignedClaimIds.length}`,
      );
    }
  }
  const topClaims = bundle.targetKg.claims.filter((c) => c.priority === 'critical' || c.priority === 'high').slice(0, 12);
  if (topClaims.length) {
    lines.push('Priority claims:');
    for (const c of topClaims) lines.push(`  • ${c.statement} (${c.gainClass})`);
  }
  const topQ = bundle.targetKg.questions.slice(0, 8);
  if (topQ.length) {
    lines.push('Priority questions:');
    for (const q of topQ) lines.push(`  • ${q.question}`);
  }
  lines.push('HARD: No write until outline/briefs validated. Prefer actions over definitions.');
  return lines.join('\n');
}
