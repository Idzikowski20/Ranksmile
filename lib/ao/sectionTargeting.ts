/**
 * Intent-aware section targeting.
 * Chain: explicit → semantic/heading → body-only for term/entity/fact → reject.
 * Never generic best-scored intro for missing topics.
 */
import type { CriticalContentMap } from './criticalContentMap';
import type { EditCandidate } from './editCandidate';
import type { Section } from '../articleSections';

export type SectionTargetScore = {
  sectionId: string;
  intentRelevance: number;
  topicCoverageGap: number;
  optimizationOpportunity: number;
  isCritical: boolean;
  isCommercial: boolean;
  confidence: number;
  total: number;
};

export const TARGET_CONFIDENCE_MIN = 0.35;

function overlap(a: string, b: string): number {
  const ta = a.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  const tb = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length >= 3));
  if (!ta.length) return 0;
  return ta.filter((t) => tb.has(t) || [...tb].some((x) => x.includes(t) || t.includes(x))).length / ta.length;
}

export function scoreSectionsForTarget(opts: {
  sections: Section[];
  candidate: EditCandidate;
  critical: CriticalContentMap;
}): SectionTargetScore[] {
  const gap = opts.candidate.targetGap;
  return opts.sections.map((sec) => {
    const isCritical = opts.critical.protectedSectionIds.includes(sec.id);
    const isCommercial = opts.critical.commercialSections.some((c) => c.sectionId === sec.id);
    const intentRelevance = Math.max(
      overlap(gap, sec.headingText),
      overlap(gap, sec.html.replace(/<[^>]+>/g, ' ')),
    );
    const topicCoverageGap = opts.candidate.priority === 'critical' ? 0.8
      : opts.candidate.priority === 'recommended' ? 0.5 : 0.3;
    const optimizationOpportunity = intentRelevance * topicCoverageGap;
    const criticalRisk = isCritical ? 0.4 : 0;
    const commercialRisk = isCommercial ? 0.35 : 0;
    const total =
      intentRelevance * 0.45
      + topicCoverageGap * 0.25
      + optimizationOpportunity * 0.2
      - criticalRisk
      - commercialRisk;
    const confidence = Math.max(0, Math.min(1, intentRelevance * (isCritical ? 0.7 : 1)));
    return {
      sectionId: sec.id,
      intentRelevance,
      topicCoverageGap,
      optimizationOpportunity,
      isCritical,
      isCommercial,
      confidence,
      total,
    };
  });
}

/**
 * Best target or null if uncertain.
 */
export function selectSectionTarget(opts: {
  sections: Section[];
  candidate: EditCandidate;
  critical: CriticalContentMap;
}): { sectionId: string; score: SectionTargetScore } | null {
  if (!opts.sections.length) return null;

  // add_missing_section → caller handles new block; still need an anchor section id if present
  if (opts.candidate.suggestedAction === 'add_missing_section') {
    const last = opts.sections[opts.sections.length - 1];
    const scored = scoreSectionsForTarget(opts);
    const s = scored.find((x) => x.sectionId === last.id) || scored[scored.length - 1];
    return { sectionId: last.id, score: { ...s, confidence: 1 } };
  }

  // 1. Explicit targetSectionId
  if (opts.candidate.targetSectionId) {
    const sec = opts.sections.find((s) => s.id === opts.candidate.targetSectionId);
    if (sec) {
      const scored = scoreSectionsForTarget(opts);
      const hinted = scored.find((s) => s.sectionId === sec.id);
      if (hinted) return { sectionId: sec.id, score: { ...hinted, confidence: Math.max(hinted.confidence, TARGET_CONFIDENCE_MIN) } };
    }
  }

  const scored = scoreSectionsForTarget(opts);
  const ranked = scored
    .map((s) => {
      const sec = opts.sections.find((x) => x.id === s.sectionId);
      const introPenalty = sec && sec.index === 0 ? 0.15 : 0;
      return { ...s, total: s.total - introPenalty };
    })
    .sort((a, b) => b.total - a.total);

  // 2–3. Semantic / heading match with confidence
  const best = ranked[0];
  if (best && best.confidence >= TARGET_CONFIDENCE_MIN && best.total >= 0.1) {
    return { sectionId: best.sectionId, score: best };
  }

  // 4. Body-only for term/entity/fact insertion — never intro dump for unrelated gaps
  const insertSources = new Set(['seo_term', 'entity']);
  if (insertSources.has(opts.candidate.source) && ranked.length > 0) {
    const body = ranked.find((s) => {
      const sec = opts.sections.find((x) => x.id === s.sectionId);
      return sec != null && sec.index > 0;
    });
    if (body) {
      return {
        sectionId: body.sectionId,
        score: { ...body, confidence: Math.max(body.confidence, TARGET_CONFIDENCE_MIN) },
      };
    }
  }

  // 5. Reject
  return null;
}
