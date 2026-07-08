import { load } from 'cheerio';

export type Section = {
  id: string;
  index: number;
  headingText: string;
  html: string;
};

/**
 * Deterministic non-crypto hash of `${index}|${headingText}`.
 * Returns a stable string id like `sec_1_2hg4r`.
 */
export function sectionId(headingText: string, index: number): string {
  const key = `${index}|${headingText}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  }
  return `sec_${index}_${(h >>> 0).toString(36)}`;
}

/**
 * Splits an HTML string into sections delimited by top-level <h2> elements.
 * Content before the first <h2> becomes section 0 (headingText ''), included
 * only if it contains non-whitespace content.
 * Each subsequent <h2> starts a new section whose html includes the heading
 * element and all following siblings up to (but not including) the next <h2>.
 */
export function splitSections(html: string): Section[] {
  const $ = load(html, null, false);

  // Collect top-level nodes
  const topNodes = $.root().contents().toArray();

  // Group nodes into buckets: intro bucket + one bucket per h2
  const buckets: Array<{ heading: ReturnType<typeof $> | null; nodes: typeof topNodes }> = [];
  let current: typeof topNodes = [];

  for (const node of topNodes) {
    if (node.type === 'tag' && node.name === 'h2') {
      // Push whatever was accumulated into an intro or previous section bucket
      buckets.push({ heading: null, nodes: current });
      current = [node];
    } else {
      current.push(node);
    }
  }
  // Push the last accumulated group
  buckets.push({ heading: null, nodes: current });

  const sections: Section[] = [];

  for (let i = 0; i < buckets.length; i++) {
    const { nodes } = buckets[i];
    if (nodes.length === 0) continue;

    const firstNode = nodes[0];
    const isH2Section = firstNode.type === 'tag' && firstNode.name === 'h2';

    if (!isH2Section) {
      // Intro section — only include if there's non-whitespace content
      const serialized = nodes.map((n) => $.html(n)).join('');
      if (!/\S/.test($(nodes).text())) continue;
      const index = sections.length;
      sections.push({
        id: sectionId('', index),
        index,
        headingText: '',
        html: serialized,
      });
    } else {
      // H2-headed section
      const h2 = $(firstNode);
      const headingText = h2.text().trim();
      const serialized = nodes.map((n) => $.html(n)).join('');
      const index = sections.length;
      sections.push({
        id: sectionId(headingText, index),
        index,
        headingText,
        html: serialized,
      });
    }
  }

  return sections;
}

/** Reassemble section HTML in order (inverse of splitSections). */
export function joinSections(sections: Section[]): string {
  return sections.map((s) => s.html).join('\n');
}

/**
 * Normalizes HTML for diffing:
 * - Removes all HTML comment nodes
 * - Collapses runs of whitespace to a single space inside text nodes
 * - Serializes and strips inter-tag whitespace, then trims
 *
 * Does NOT reorder or sort attributes, class, or style values.
 */
export function normalizeHtmlForDiff(html: string): string {
  const $ = load(html, null, false);

  // Remove all comment nodes (recursively through all descendants)
  $.root()
    .find('*')
    .addBack()
    .contents()
    .filter((_, node) => node.type === 'comment')
    .remove();

  // Collapse whitespace in all text nodes and trim leading/trailing whitespace
  $.root()
    .find('*')
    .addBack()
    .contents()
    .filter((_, node) => node.type === 'text')
    .each((_, node) => {
      (node as { data: string }).data = (node as { data: string }).data.replace(/\s+/g, ' ').trim();
    });

  return $.html().replace(/>\s+</g, '><').trim();
}
