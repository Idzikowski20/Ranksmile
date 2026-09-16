/**
 * Seed keywords from a Brand Knowledge draft.
 *
 * The draft is written to a fixed template (see the sidecar's generate_brand_knowledge),
 * whose "Topics to cover" section holds the phrases a writer would target — exactly what
 * Suggest expands and the SERP stage ranks competitors for. Reading that section beats
 * splitting the whole draft into words, which fed the pipeline the template's own English
 * headers ("Business", "Industry") and half-sentences ("specjalizująca").
 */

/** The heading, as the template writes it and as models translate it. */
const TOPICS_HEADING = /^\s*(topics? to cover|tematy do (?:poruszenia|omówienia|pokrycia)|tematy)\s*:?\s*$/i;

/** A line that opens the next section: a short, prose-free label. */
const SECTION_HEADING = /^\s*[A-ZŻŹĆĄŚĘŁÓŃ][^.!?]{0,60}\s*:?\s*$/;

/** What a model writes instead of leaving the section out. */
const NO_DATA = /^(brak|nie |no |n\/a|none)\b/i;

const MAX_SEEDS = 12;
const MAX_SEED_CHARS = 60;

/** Strip list bullets and numbering the model may add. */
function stripBullet(line: string): string {
  return line.replace(/^[\s\-*•–—]+/, '').replace(/^\d+[.)]\s*/, '');
}

function isPhrase(candidate: string): boolean {
  if (candidate.length < 3 || candidate.length > MAX_SEED_CHARS) return false;
  // One-word entries are usually a stray label, and a bare word makes a useless SERP query.
  return candidate.split(/\s+/).length >= 2;
}

/** The lines under "Topics to cover", up to the next section heading. */
function topicsSection(brandKnowledge: string): string[] {
  const lines = (brandKnowledge || '').split(/\r?\n/);
  const start = lines.findIndex((line) => TOPICS_HEADING.test(line));
  if (start === -1) return [];
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const text = line.trim();
    if (!text) {
      // A blank line ends the section only once it has content — the template puts one
      // straight after some headings.
      if (body.length) break;
      continue;
    }
    if (SECTION_HEADING.test(text) && !text.includes(',')) break;
    body.push(stripBullet(text));
  }
  return body;
}

export function seedsFromBrandKnowledge(brandKnowledge: string): string[] {
  const body = topicsSection(brandKnowledge);
  if (!body.length || body.every((line) => NO_DATA.test(line))) return [];

  const seen = new Set<string>();
  const seeds: string[] = [];
  for (const line of body) {
    for (const part of line.split(/[,;]|\s+\/\s+/)) {
      const candidate = part.trim().replace(/\.$/, '').toLowerCase();
      if (!isPhrase(candidate) || NO_DATA.test(candidate) || seen.has(candidate)) continue;
      seen.add(candidate);
      seeds.push(candidate);
      if (seeds.length >= MAX_SEEDS) return seeds;
    }
  }
  return seeds;
}
