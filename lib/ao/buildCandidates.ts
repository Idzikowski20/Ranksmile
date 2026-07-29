import type { EditCandidate } from './editCandidate';
import { makeCandidate, sortCandidatesByPriority } from './editCandidate';
import type { ArticleIntentProfile } from './intentProfile';
import { textHitsForbidden } from './intentProfile';
import type { CoverageItem } from '../aiCoverage';
import { AI_SEARCH_CHECKPOINT_TYPES } from '../aiCoverage';
import { ADEQUATE_QUALITY_MIN } from './coverageState';
import type { TermUsageGap } from '../optimizeSectionEdit';
import type { Section } from '../articleSections';
import type { OptimizationStrategy } from './optimizationPolicy';

export type BuildCandidatesInput = {
  profile: ArticleIntentProfile;
  termGaps?: TermUsageGap[];
  coverageItems?: readonly CoverageItem[];
  paaQuestions?: string[];
  visibilityPrompts?: Array<{ id: string; label: string }>;
  defaultSectionId?: string;
  sections?: Section[];
  strategy?: OptimizationStrategy;
  seoStrong?: boolean;
  aiWeak?: boolean;
};

function slug(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'x';
}

function priorityFromImportance(
  importance: CoverageItem['importance'] | undefined,
): EditCandidate['priority'] {
  if (importance === 'critical') return 'critical';
  if (importance === 'optional') return 'optional';
  return 'recommended';
}

function countWords(html: string): number {
  const t = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Evaluate section — strong gets no section_quality candidate. */
export function classifySectionQuality(sec: Section): 'strong' | 'medium' | 'weak' {
  const words = countWords(sec.html);
  const paras = (sec.html.match(/<p\b/gi) || []).length;
  if (words < 40 || paras === 0) return 'weak';
  if (words < 120 || paras < 2) return 'medium';
  return 'strong';
}

/** Gaps + justified section candidates only (evaluate all ≠ generate all). */
export function buildEditCandidates(input: BuildCandidatesInput): EditCandidate[] {
  const out: EditCandidate[] = [];
  const profile = input.profile;
  const sectionHint = input.defaultSectionId;
  const strategy = input.strategy || 'precision';
  const skipLowNlp = Boolean(input.seoStrong && input.aiWeak);

  if (!skipLowNlp) {
    for (const g of input.termGaps || []) {
      if (g.status !== 'missing' && g.status !== 'low') continue;
      const gap = g.term;
      if (textHitsForbidden(gap, profile)) continue;
      out.push(
        makeCandidate({
          id: `seo-${g.term}`,
          gapId: `seo:term:${slug(g.term)}`,
          source: 'seo_term',
          targetSectionId: sectionHint,
          targetGap: `Naturally include the term "${g.term}" once in an existing paragraph.`,
          reason: `Missing or low NLP term "${g.term}"`,
          expectedOutcome: { type: 'generic', id: `seo:term:${slug(g.term)}` },
          priority: g.status === 'missing' ? 'recommended' : 'optional',
          priorityTier: g.status === 'missing' ? 3 : 5,
          suggestedAction: 'insert_sentence',
          intentFit: 0.55,
          factualRisk: 0.1,
        }),
      );
    }
  }

  for (const it of input.coverageItems || []) {
    if (it.category !== 'intent' && it.category !== 'knowledge' && it.category !== 'authority') {
      continue;
    }
    if (!AI_SEARCH_CHECKPOINT_TYPES.has(it.type)) continue;
    if (it.covered && it.quality >= ADEQUATE_QUALITY_MIN) continue;
    if (textHitsForbidden(it.label, profile)) continue;

    const source: EditCandidate['source'] =
      it.type === 'paa' || it.type === 'question' || it.type === 'intent'
        ? 'paa'
        : it.type === 'entity'
          ? 'entity'
          : 'ai_coverage';

    const gapId =
      source === 'entity'
        ? `coverage:entity:${slug(it.label)}`
        : source === 'paa'
          ? `coverage:question:${slug(it.label)}`
          : `coverage:item:${slug(it.id || it.label)}`;

    const tier: 0 | 2 = it.importance === 'critical' ? 0 : 2;

    out.push(
      makeCandidate({
        id: `cov-${it.id}`,
        gapId,
        source,
        targetSectionId: sectionHint,
        targetGap: it.label,
        reason: `Uncovered ${source}: ${it.label}`,
        expectedOutcome: { type: 'coverage_item_resolved', id: gapId },
        priority: priorityFromImportance(it.importance),
        priorityTier: tier,
        suggestedAction: source === 'entity' ? 'add_facts' : 'improve_direct_answer',
        intentFit: 0.55,
        factualRisk: profile.sensitiveDomain ? 0.45 : 0.2,
      }),
    );
  }

  for (let i = 0; i < (input.paaQuestions || []).length; i++) {
    const label = input.paaQuestions![i];
    if (!label || label.length < 8) continue;
    if (textHitsForbidden(label, profile)) continue;
    if (out.some((c) => c.targetGap === label)) continue;
    const gapId = `coverage:question:${slug(label)}`;
    out.push(
      makeCandidate({
        id: `paa-${i}`,
        gapId,
        source: 'paa',
        targetSectionId: sectionHint,
        targetGap: label,
        reason: `PAA unanswered: ${label}`,
        expectedOutcome: { type: 'direct_answer_present', id: gapId },
        priority: 'recommended',
        priorityTier: 2,
        suggestedAction: 'improve_direct_answer',
        intentFit: 0.5,
        factualRisk: 0.25,
      }),
    );
  }

  for (const v of input.visibilityPrompts || []) {
    if (!v.label || v.label.length < 8) continue;
    if (textHitsForbidden(v.label, profile)) continue;
    if (out.some((c) => c.targetGap === v.label)) continue;
    const gapId = `coverage:visibility:${slug(v.label)}`;
    out.push(
      makeCandidate({
        id: v.id || `vis-${v.label.slice(0, 20)}`,
        gapId,
        source: 'visibility',
        targetSectionId: sectionHint,
        targetGap: v.label,
        reason: `Visibility prompt gap: ${v.label}`,
        expectedOutcome: { type: 'coverage_item_resolved', id: gapId },
        priority: 'optional',
        priorityTier: 2,
        suggestedAction: 'add_facts',
        intentFit: 0.45,
        factualRisk: 0.3,
      }),
    );
  }

  if (input.sections?.length) {
    const allowSectionEdits =
      strategy === 'enrichment'
      || strategy === 'deep_optimize'
      || (strategy === 'precision' && input.aiWeak);

    if (allowSectionEdits) {
      for (const sec of input.sections) {
        const q = classifySectionQuality(sec);
        if (q === 'strong') continue;
        if (strategy === 'precision' && q !== 'weak') continue;
        const gapId = `section:quality:${sec.id}`;
        out.push(
          makeCandidate({
            id: `sec-${sec.id}-${q}`,
            gapId,
            source: 'section_quality',
            targetSectionId: sec.id,
            targetGap: q === 'weak'
              ? `Rewrite section "${sec.headingText || sec.id}" to satisfy intent with facts/examples; do not pad.`
              : `Expand section "${sec.headingText || sec.id}" for missing depth; do not pad to a word count.`,
            reason: `Section quality ${q}`,
            expectedOutcome: { type: 'section_quality_improved', id: gapId },
            priority: q === 'weak' ? 'recommended' : 'optional',
            priorityTier: 4,
            suggestedAction: q === 'weak' ? 'rewrite_section' : 'expand_section',
            intentFit: 0.6,
            factualRisk: 0.2,
          }),
        );
      }
    }
  }

  return sortCandidatesByPriority(out);
}
