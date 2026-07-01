import type { Guideline } from './recommendationEngine';
import type { Section } from './articleSections';
import type { Importance } from './aiCoverage';
import { countOccurrences } from './contentScore';

export interface RoutedGuideline {
  guideline: Guideline;
  confidence: number;   // [0,1]
  reason: string;
  priority: number;
}

// Tunable routing weights — a single-constant edit re-tunes routing.
const W_HEADING = 1.0;
const W_BODY = 0.6;
const W_FREQ = 0.5;
const W_SECTION = 3.0;
const MATCH_THRESHOLD = 0.15;                          // below this, the guideline falls back (Task 2)
const CONFIDENCE_NORM = W_HEADING + W_BODY + W_FREQ;   // a strong non-sectionId match ~ confidence 1

const IMPORTANCE_WEIGHT: Record<Importance, number> = { critical: 3, recommended: 2, optional: 1 };
export const importanceWeight = (imp: Importance): number => IMPORTANCE_WEIGHT[imp];

/** Local, stem-free tokenizer — keep routing self-contained (do NOT reuse contentScore.tokenize, Polish-stem specific). */
function tokens(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 2));
}
function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}
/** Overlap coefficient: intersection / min(size). 0 when either side empty. */
function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits += 1;
  return hits / Math.min(a.size, b.size);
}

/** The distinctive term of a guideline — its title minus the C prefix ("Cover:", "Use the term:", ...). */
function keyTerm(g: Guideline): string {
  return g.title.replace(/^(Cover|Expand|Use the term|Add):\s*/i, '').trim() || g.title;
}

interface Scored { section: Section; score: number; reason: string; }

function scoreSection(g: Guideline, section: Section, maxFreq: number): Scored {
  if (g.sectionId && g.sectionId === section.id) {
    return { section, score: W_SECTION, reason: 'Exact section match' };
  }
  const gTokens = tokens(`${g.title} ${g.instruction}`);
  const headingSim = overlap(gTokens, tokens(section.headingText));
  const body = plainText(section.html);
  const bodySim = overlap(gTokens, tokens(body));
  const term = keyTerm(g);
  const freq = maxFreq > 0 ? countOccurrences(body, term) / maxFreq : 0;
  const score = W_HEADING * headingSim + W_BODY * bodySim + W_FREQ * freq;
  const reason = headingSim >= bodySim && headingSim > 0
    ? `Heading overlap ${headingSim.toFixed(2)}`
    : (freq > 0 ? `Matched term ${term}` : 'Body-term match');
  return { section, score, reason };
}

export interface RouteOpts { breakdown: { slots: Array<{ key: string; missingPoints: number }>; totalPossible: number }; }

/** Section for a below-threshold guideline: intent -> intro (index 0); else highest missingPoints. */
function fallbackSection(g: Guideline, sections: Section[], opts: RouteOpts): { section: Section; reason: string } | null {
  if (!sections.length) return null;
  if (g.group === 'intent') {
    const intro = sections.find((s) => s.index === 0) ?? sections[0];
    return { section: intro, reason: 'Fallback — intent to intro' };
  }
  const byMissing = [...sections].sort((a, b) => {
    const ma = opts.breakdown.slots.find((s) => s.key === b.id)?.missingPoints ?? 0;
    const mb = opts.breakdown.slots.find((s) => s.key === a.id)?.missingPoints ?? 0;
    return ma - mb;
  });
  return { section: byMissing[0], reason: 'Fallback — highest missingPoints' };
}

export function assignGuidelinesToSections(
  guidelines: Guideline[], sections: Section[], opts: RouteOpts,
): Map<string, RoutedGuideline[]> {
  const out = new Map<string, RoutedGuideline[]>();
  const push = (sectionId: string, rg: RoutedGuideline) => {
    const arr = out.get(sectionId) ?? [];
    arr.push(rg);
    out.set(sectionId, arr);
  };
  for (const guideline of guidelines) {
    const term = keyTerm(guideline);
    const maxFreq = Math.max(1, ...sections.map((s) => countOccurrences(plainText(s.html), term)));
    const scored = sections.map((s) => scoreSection(guideline, s, maxFreq)).sort((a, b) => b.score - a.score);
    const best = scored[0];
    let target: Section;
    let confidence: number;
    let reason: string;
    if (best && best.score >= MATCH_THRESHOLD) {
      target = best.section;
      confidence = best.reason === 'Exact section match' ? 1 : Math.min(1, best.score / CONFIDENCE_NORM);
      reason = best.reason;
    } else {
      const fb = fallbackSection(guideline, sections, opts);
      if (!fb) continue;                       // no sections at all — nothing to route to
      target = fb.section;
      confidence = 0.1;                        // low — it is a guess
      reason = fb.reason;
    }
    const priority = importanceWeight(guideline.importance) * guideline.projectedLift * confidence;
    push(target.id, { guideline, confidence, reason, priority });
  }
  // Priority sort inside each section (drives prompt bullet order + step focus).
  for (const arr of out.values()) arr.sort((a, b) => b.priority - a.priority);
  return out;
}
