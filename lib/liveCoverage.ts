// lib/liveCoverage.ts
// Pure client-side re-score core. Re-derives presence-checkable CoverageItem.covered from the
// current editor text/HTML between LLM judge passes, without mutating the graded snapshot.
import type { CoverageItem, CoverageType, BucketScore } from './aiCoverage';
import { countOccurrences } from './contentScore';

export const PRESENCE_CHECKABLE: ReadonlySet<CoverageType> = new Set(['entity', 'structure', 'readability', 'paa', 'intent']);

/** Re-derive `covered` for presence-checkable items from the current text/HTML; carry frozen items
 *  verbatim. Immutable — returns a NEW readonly array, never mutates an item. */
export function liveCoverageItems(
  snapshotItems: readonly CoverageItem[],
  plainText: string,
  html: string,
): readonly CoverageItem[] {
  return snapshotItems.map((it) => {
    if (!PRESENCE_CHECKABLE.has(it.type)) return it;
    const covered = presenceCovered(it, plainText, html);
    if (covered === it.covered && !(covered && it.quality === 0)) return it;
    if (!covered) return { ...it, covered: false };
    const floor = it.importance === 'critical' ? 4 : it.importance === 'recommended' ? 3 : 2;
    return { ...it, covered: true, quality: Math.max(it.quality, floor) };
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
    case 'intent':      return faqAnswered(it.label, html);
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

/** Normalize a coverage question label for fuzzy matching (Semrush/Surfer H3-as-question pattern). */
export function normalizeCoverageQuestion(q: string): string {
  return q.toLowerCase()
    .replace(/[?!.,;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function questionTokenOverlap(a: string, b: string): number {
  const wa = normalizeCoverageQuestion(a).split(/\s+/).filter((w) => w.length > 2);
  const wb = new Set(normalizeCoverageQuestion(b).split(/\s+/).filter((w) => w.length > 2));
  if (wa.length === 0) return 0;
  return wa.filter((w) => wb.has(w)).length / wa.length;
}

/** Extract heading + following paragraph pairs (FAQ / PAA structure). */
function extractHeadingAnswerPairs(html: string): Array<{ question: string; answer: string }> {
  const pairs: Array<{ question: string; answer: string }> = [];
  const re = /<h([2-4])[^>]*>([\s\S]*?)<\/h\1>\s*(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
  let m = re.exec(html);
  while (m) {
    const question = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const answer = (m[3] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (question) pairs.push({ question, answer });
    m = re.exec(html);
  }
  return pairs;
}

/** Readability signal: average chars-per-<p> in the 100–200 optimal range. */
function readableParagraphs(html: string): boolean {
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  if (paras.length < 2) return false;
  const avg = paras.reduce((sum, m) => {
    const chars = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().length;
    return sum + chars;
  }, 0) / paras.length;
  return avg >= 80 && avg <= 250;
}

/** FAQ-answered signal — Surfer/Semrush pattern: question as H2/H3 + direct short answer in <p>. */
function faqAnswered(label: string, html: string): boolean {
  const normalizedLabel = normalizeCoverageQuestion(label);
  const pairs = extractHeadingAnswerPairs(html);

  for (const { question, answer } of pairs) {
    const nq = normalizeCoverageQuestion(question);
    const overlap = questionTokenOverlap(label, question);
    const exactish = nq === normalizedLabel
      || nq.includes(normalizedLabel)
      || normalizedLabel.includes(nq)
      || overlap >= 0.75;
    if (exactish && answer.length >= 30) return true;
  }

  const bodyText = html.replace(/<[^>]+>/g, ' ').toLowerCase();
  const headings = [...html.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').toLowerCase());

  const STOP = new Set(['co', 'jak', 'czy', 'ile', 'kiedy', 'gdzie', 'dlaczego', 'czym',
    'the', 'what', 'how', 'why', 'when', 'where', 'is', 'are', 'do', 'does', 'can']);

  const words = label.toLowerCase().replace(/[?!.,]/g, '').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
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

const TYPE_DISPLAY_LABEL: Record<CoverageType, string> = {
  entity: 'Entities', fact: 'Facts', paa: 'Questions', structure: 'Structure',
  readability: 'Readability', intent: 'Intent', definition: 'Definitions',
  comparison: 'Comparisons', example: 'Examples', process: 'Processes',
  statistic: 'Statistics', expectation: 'Expectations', warning: 'Warnings',
};

/** Uncovered items grouped per TYPE ("Entities 0 · Facts 3 · Questions 2 · Structure 1") —
 *  the "Remaining AI Opportunities" panel. Per-type, NOT per-category (spec: separate rows). */
export function remainingOpportunities(liveItems: readonly CoverageItem[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const it of liveItems) {
    if (it.covered) continue;
    const label = TYPE_DISPLAY_LABEL[it.type] ?? it.type;
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
