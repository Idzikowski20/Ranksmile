// lib/liveCoverage.ts
// Pure client-side re-score core. Re-derives presence-checkable CoverageItem.covered from the
// current editor text/HTML between LLM judge passes, without mutating the graded snapshot.
import type { CoverageItem, CoverageType, BucketScore } from './aiCoverage';
import { countOccurrences } from './contentScore';

export const PRESENCE_CHECKABLE: ReadonlySet<CoverageType> = new Set(['entity', 'structure', 'readability', 'paa']);

/** Re-derive `covered` for presence-checkable items from the current text/HTML; carry frozen items
 *  verbatim. Immutable — returns a NEW readonly array, never mutates an item. */
export function liveCoverageItems(
  snapshotItems: readonly CoverageItem[],
  plainText: string,
  html: string,
): readonly CoverageItem[] {
  return snapshotItems.map((it) => {
    if (!PRESENCE_CHECKABLE.has(it.type)) return it;                 // frozen — verbatim
    const covered = presenceCovered(it, plainText, html);
    return covered === it.covered ? it : { ...it, covered };         // spread, never mutate
  });
}

/** Deterministic presence check per type. Local re-implementations of the same rules the content
 *  scorer uses (contentScore.ts helpers are private + must stay untouched — Part 8). */
function presenceCovered(it: CoverageItem, plainText: string, html: string): boolean {
  switch (it.type) {
    case 'entity':      return countOccurrences(plainText, it.label) >= 1;             // == contentScore.ts:336
    case 'structure':   return hasStructure(html);                                     // headings/lists/question-format
    case 'readability': return readableParagraphs(html);                               // paragraph-length metric
    case 'paa':         return faqAnswered(it.label, html);                            // question answered in body/heading
    default:            return it.covered;
  }
}

/** Structural signal: at least one heading (h2-h4) OR a substantial list (>=3 <li>). Local mirror
 *  of contentScore.ts `_listUsage` intent, extended to also count headings as "structure". */
function hasStructure(html: string): boolean {
  if (/<h[2-4][^>]*>/i.test(html)) return true;
  const lists = html.match(/<(ul|ol)[^>]*>([\s\S]*?)<\/(ul|ol)>/gi) || [];
  return lists.some((l) => (l.match(/<li/gi) || []).length >= 3);
}

/** Readability signal: average words-per-<p> falls in the optimal 40-100 range. Local mirror of
 *  contentScore.ts `_readability` (score>0 range), reduced to a boolean presence check. */
function readableParagraphs(html: string): boolean {
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  if (paras.length < 2) return false;
  const avg = paras.reduce((sum, m) => {
    const words = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    return sum + words;
  }, 0) / paras.length;
  return avg >= 40 && avg <= 100;
}

/** FAQ-answered signal: >=70% of the question's content words appear in the body, OR >=60% appear
 *  in a single heading. Local mirror of contentScore.ts `_faqCoverage` per-question logic. */
function faqAnswered(label: string, html: string): boolean {
  const bodyText = html.replace(/<[^>]+>/g, ' ').toLowerCase();
  const headings = [...html.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').toLowerCase());

  const STOP = new Set(['co', 'jak', 'czy', 'ile', 'kiedy', 'gdzie', 'dlaczego', 'czym',
    'the', 'what', 'how', 'why', 'when', 'where', 'is', 'are', 'do', 'does', 'can']);

  const words = label.toLowerCase().replace(/[?!.,]/g, '').split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
  if (words.length === 0) return true;

  const bodyHit = words.filter((w) => bodyText.includes(w)).length / words.length >= 0.7;
  const headingHit = headings.some((h) => words.filter((w) => h.includes(w)).length / words.length >= 0.6);
  return bodyHit || headingHit;
}

/** Positive per-bucket deltas only, sorted desc — "why it improved". Matched by bucket key. */
export function scoreAttribution(before: readonly BucketScore[], after: readonly BucketScore[]): Array<{ label: string; delta: number }> {
  const beforeByKey = new Map(before.map((b) => [b.key, b.score]));
  return after
    .map((b) => ({ label: b.label, delta: b.score - (beforeByKey.get(b.key) ?? b.score) }))
    .filter((r) => r.delta > 0)
    .sort((a, b) => b.delta - a.delta);
}

const CATEGORY_DISPLAY_LABEL: Record<CoverageItem['category'], string> = {
  intent: 'Intent', knowledge: 'Entities & Facts', authority: 'Authority', quality: 'Structure & Readability', style: 'Style',
};

/** Uncovered items grouped by display bucket — the "Remaining AI Opportunities" panel. */
export function remainingOpportunities(liveItems: readonly CoverageItem[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const it of liveItems) {
    if (it.covered) continue;
    const label = CATEGORY_DISPLAY_LABEL[it.category] ?? it.category;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Real-evaluation gate: only a positive recomputed delta animates. */
export function scoreDeltaGate(oldScore: number, newScore: number): { animate: boolean; delta: number } {
  const delta = Math.round(newScore) - Math.round(oldScore);
  return { animate: delta > 0, delta };
}
