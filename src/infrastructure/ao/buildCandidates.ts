import type { EditCandidate } from '@/src/core/domain/optimize/editCandidate';
import { makeCandidate, sortCandidatesByPriority } from '@/src/core/domain/optimize/editCandidate';
import type { ArticleIntentProfile } from '@/src/core/domain/optimize/intentProfile';
import { textHitsForbidden } from '@/src/core/domain/optimize/intentProfile';
import type { CoverageItem } from '@/src/core/domain/coverage/aiCoverage';
import { AI_SEARCH_CHECKPOINT_TYPES } from '@/src/core/domain/coverage/aiCoverage';
import { ADEQUATE_QUALITY_MIN, AI_SCORE_QUALITY_MAX } from '@/src/core/domain/optimize/coverageState';
import type { TermUsageGap } from '@/src/infrastructure/ao/optimizeSectionEdit';
import type { Section } from '@/src/infrastructure/articles/articleSections';
import type { OptimizationStrategy } from '@/src/infrastructure/ao/optimizationPolicy';
import { findSectionForHeading, missingPlannedHeadings } from '@/src/core/domain/optimize/plannedSections';

export type BuildCandidatesInput = {
  profile: ArticleIntentProfile;
  /** Common competitor H2 titles — sections the ranking pages carry (Surfer-style). */
  competitorHeadings?: string[];
  termGaps?: TermUsageGap[];
  /** SERP heading terms no H2/H3 of the article carries yet. */
  headingTerms?: string[];
  coverageItems?: readonly CoverageItem[];
  paaQuestions?: string[];
  visibilityPrompts?: Array<{ id: string; label: string }>;
  defaultSectionId?: string;
  sections?: Section[];
  strategy?: OptimizationStrategy;
  seoStrong?: boolean;
  aiWeak?: boolean;
  /** Mode 'full': the article is weak enough to rebuild toward the plan. */
  rebuild?: boolean;
  /** H2 titles the content plan intended — the generator's own outline. */
  plannedHeadings?: string[];
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

function coverageSource(type: CoverageItem['type']): EditCandidate['source'] {
  if (type === 'paa' || type === 'question' || type === 'intent') return 'paa';
  if (type === 'entity') return 'entity';
  return 'ai_coverage';
}

function coverageGapId(source: EditCandidate['source'], it: CoverageItem): string {
  if (source === 'entity') return `coverage:entity:${slug(it.label)}`;
  if (source === 'paa') return `coverage:question:${slug(it.label)}`;
  return `coverage:item:${slug(it.id || it.label)}`;
}

function coverageAction(o: {
  isIntent: boolean; covered: boolean; introThin: boolean; source: EditCandidate['source'];
}): string {
  if (o.isIntent && !o.covered && o.introThin) return 'rewrite_section';
  return o.source === 'entity' ? 'add_facts' : 'improve_direct_answer';
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
  const { profile } = input;
  const sectionHint = input.defaultSectionId;
  const strategy = input.strategy || 'precision';
  const skipLowNlp = Boolean(input.seoStrong && input.aiWeak);

  if (!skipLowNlp) {
    const gaps = (input.termGaps || []).filter(
      (g) => (g.status === 'missing' || g.status === 'low') && !textHitsForbidden(g.term, profile),
    );
    for (const g of gaps) {
      out.push(
        makeCandidate({
          id: `seo-${g.term}`,
          gapId: `seo:term:${slug(g.term)}`,
          source: 'seo_term',
          targetSectionId: sectionHint,
          phrase: g.term,
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

  for (const term of (input.headingTerms || []).filter((t) => !textHitsForbidden(t, profile))) {
    out.push(
      makeCandidate({
        id: `heading-${term}`,
        gapId: `seo:heading:${slug(term)}`,
        source: 'seo_term',
        targetSectionId: sectionHint,
        phrase: term,
        targetGap: `Include "${term}" in the section heading (H2).`,
        reason: `Ranking pages carry "${term}" in a heading; ours do not`,
        expectedOutcome: { type: 'generic', id: `seo:heading:${slug(term)}` },
        priority: 'recommended',
        priorityTier: 3,
        suggestedAction: 'enrich_heading',
        intentFit: 0.55,
        factualRisk: 0.1,
      }),
    );
  }

  // The intro answers the main question, says who the article is for and why it
  // matters (Surfer's Upfront Intent Alignment). An intent gap belongs there — as a
  // rewrite into prose when the lead never answered, a strengthened answer when it did.
  const intro = input.sections?.find((s) => s.index === 0);
  const introThin = intro != null && classifySectionQuality(intro) !== 'strong';

  // The gauge is quality/5 × 85 (+15 early answer): with every item at 4 it tops out
  // near 83. While AI is weak, a 4 is still a gap to deepen; 5 is done.
  const qualityDone = input.aiWeak ? AI_SCORE_QUALITY_MAX : ADEQUATE_QUALITY_MIN;
  const checkpoints = (input.coverageItems || []).filter(
    (it) => (it.category === 'intent' || it.category === 'knowledge' || it.category === 'authority')
      && AI_SEARCH_CHECKPOINT_TYPES.has(it.type)
      && !(it.covered && it.quality >= qualityDone)
      && !textHitsForbidden(it.label, profile),
  );
  for (const it of checkpoints) {
    const source = coverageSource(it.type);
    const gapId = coverageGapId(source, it);

    const shallow = it.covered && it.quality > 0 && it.quality < qualityDone;
    // Uncovered first; deepening an answer that exists comes after.
    const tier: 0 | 1 | 2 | 3 = (it.importance === 'critical' ? 0 : 2) + (shallow ? 1 : 0) as 0 | 1 | 2 | 3;
    const isIntent = it.type === 'intent' && intro != null;

    out.push(
      makeCandidate({
        id: `cov-${it.id}`,
        gapId,
        source,
        targetSectionId: isIntent ? intro.id : sectionHint,
        targetGap: it.label,
        reason: shallow
          ? `Shallow AI answer (quality ${it.quality}/${qualityDone}): ${it.label}`
          : `Uncovered ${source}: ${it.label}`,
        expectedOutcome: { type: 'coverage_item_resolved', id: gapId },
        priority: priorityFromImportance(it.importance),
        priorityTier: tier,
        suggestedAction: coverageAction({ isIntent, covered: it.covered, introThin, source }),
        intentFit: 0.55,
        factualRisk: profile.sensitiveDomain ? 0.45 : 0.2,
      }),
    );
  }

  (input.paaQuestions || []).forEach((label, i) => {
    if (!label || label.length < 8) return;
    if (textHitsForbidden(label, profile)) return;
    if (out.some((c) => c.targetGap === label)) return;
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
  });

  (input.visibilityPrompts || []).forEach((v) => {
    if (!v.label || v.label.length < 8) return;
    if (textHitsForbidden(v.label, profile)) return;
    if (out.some((c) => c.targetGap === v.label)) return;
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
  });

  if (input.sections?.length) {
    const allowSectionEdits = strategy === 'enrichment'
      || strategy === 'deep_optimize'
      || (strategy === 'precision' && input.aiWeak);

    if (allowSectionEdits) {
      const graded = input.sections
        .map((sec) => ({ sec, q: classifySectionQuality(sec) }))
        .filter(({ q }) => q !== 'strong' && !(strategy === 'precision' && q !== 'weak'));
      for (const { sec, q } of graded) {
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

  // Missing sections, the way Surfer adds them: a topic the ranking pages share a
  // heading for and the article does not cover gets a whole new section, not a
  // sentence squeezed into an existing one. Capped hard — two per run keeps AO from
  // rebuilding the article's shape wholesale.
  // Planned headings first: when the article drifted from its own content plan
  // (imported, damaged, heavily edited), the plan is the strongest statement of what
  // sections should exist — the same outline the generator writes from. Competitor
  // headings top up after. Precision strategy is no longer excluded: that exclusion
  // made section rebuild dead code, since precision is the default strategy.
  const plannedTitles = input.plannedHeadings ?? [];
  const headingSources = [
    ...plannedTitles.map((t, i) => ({ title: t, planned: true, plannedIndex: i })),
    ...(input.competitorHeadings ?? []).map((t) => ({ title: t, planned: false, plannedIndex: -1 })),
  ];
  const missingCap = input.rebuild ? 5 : 3;
  if (headingSources.length && input.sections?.length) {
    const { sections } = input;
    const articleText = sections.map((sec) => sec.html).join(' ')
      .replace(/<[^>]+>/g, ' ')
      .toLowerCase();
    const lastSection = sections[sections.length - 1];

    // A restored section belongs where the plan put it, not at the end of the article.
    // Anchor it after the nearest EARLIER planned heading the article still has; when
    // nothing before it survived, put it right after the opening section. Anchoring every
    // missing section to the last one is why repaired sections always landed at the very
    // bottom, after the summary and FAQ.
    //
    // ponytail: ceiling = two consecutive missing planned sections both anchor to the same
    // surviving heading, so they can land in reverse order relative to each other. Upgrade =
    // re-anchor against the working HTML between steps instead of once at candidate build.
    const anchorForPlanned = (plannedIndex: number): Section => {
      for (let j = plannedIndex - 1; j >= 0; j -= 1) {
        const prev = findSectionForHeading(sections, plannedTitles[j]);
        if (prev) return prev;
      }
      return sections[0];
    };

    // A planned section is missing when no heading is left for it — its words usually
    // survive in the neighbouring sections, so the body-text rule below never saw it.
    const missingPlanned = new Set(missingPlannedHeadings(plannedTitles, sections));

    // A section the PLAN intended is structural damage whatever the score or strategy
    // says — the degraded-article test sat at SEO 68 (mode seo-first, strategy
    // precision) with seven planned sections gone, and both prior gates skipped the
    // rebuild entirely. Competitor-heading suggestions stay behind the old gate:
    // they are a nice-to-have, not the article's own contract.
    const wanted = (src: { title: string; planned: boolean }): boolean => {
      if (!src.planned && !(input.rebuild || strategy !== 'precision')) return false;
      const title = (src.title || '').trim();
      if (title.length < 8 || title.length > 90) return false;
      if (textHitsForbidden(title, profile)) return false;
      if (src.planned) return missingPlanned.has(src.title);
      // Covered when the heading's meaningful words already appear in the article.
      const words = title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);
      if (!words.length) return false;
      const hits = words.filter((w) => articleText.includes(w)).length;
      return hits / words.length < 0.6;
    };

    let added = 0;
    for (const { title: rawTitle, planned, plannedIndex } of headingSources.filter(wanted)) {
      if (added >= missingCap) break;
      const title = rawTitle.trim();
      out.push(
        makeCandidate({
          id: `missing-section-${slug(title)}`,
          gapId: `section:missing:${slug(title)}`,
          source: 'missing_section',
          targetSectionId: (planned && plannedIndex >= 0 ? anchorForPlanned(plannedIndex) : lastSection).id,
          targetGap: title,
          reason: planned
            ? `The content plan has a section "${title}"; the article lost or never had it`
            : `Ranking pages cover "${title}"; the article has no section for it`,
          priority: planned ? 'critical' : 'recommended',
          suggestedAction: 'add_missing_section',
          expectedOutcome: { type: 'generic', id: `section:missing:${slug(title)}` },
        }),
      );
      added += 1;
    }
  }

  return sortCandidatesByPriority(out);
}
