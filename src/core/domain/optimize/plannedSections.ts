/**
 * The sections the article was written with — its structural contract for Auto-Optimize.
 *
 * Source: `score_data.compiled_write_plan.knowledgePacks[].heading`, the headings the
 * section writer actually produced. NOT `content_planner_v2.bundle.outline`: that is the
 * planner's draft, which carries competitor navigation scraped off the SERP ("Spis
 * treści", "Powiązane wpisy na blogu", "Rozpocznij podróż w świat wynajmu!") — AO once
 * "restored" those as brand-new sections.
 */

type Section = { headingText: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function plannedHeadingsFromScoreData(scoreData: unknown): string[] {
  const plan = asRecord(asRecord(scoreData)?.compiled_write_plan);
  const packs = plan?.knowledgePacks;
  if (!Array.isArray(packs)) return [];
  return packs
    .map((p) => String(asRecord(p)?.heading ?? '').trim())
    .filter((h) => h.length >= 8);
}

/** Meaningful words of a heading — what a rephrased heading still shares with the plan. */
export function headingWords(title: string): string[] {
  return (title || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);
}

/** The live section whose heading carries ≥60% of a planned heading's words, if any. */
export function findSectionForHeading<S extends Section>(sections: readonly S[], title: string): S | undefined {
  const words = headingWords(title);
  if (!words.length) return undefined;
  return sections.find((sec) => {
    const text = (sec.headingText || '').toLowerCase();
    if (!text) return false;
    return words.filter((w) => text.includes(w)).length / words.length >= 0.6;
  });
}

/**
 * Planned sections with no heading left in the article. Judged on headings, not body
 * text: a deleted section's words usually survive in its neighbours, and that used to
 * count the section as present.
 * ponytail: 60% word overlap is the whole matcher; a heavily rephrased heading reads as
 * missing and gets rebuilt beside its rename. Upgrade = lemma matching from termMatch.
 */
export function missingPlannedHeadings(planned: readonly string[], sections: readonly Section[]): string[] {
  return planned.filter((h) => !findSectionForHeading(sections, h));
}
