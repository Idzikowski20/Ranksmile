import type { JSONContent } from '@tiptap/core';
import { parseApprovedOutline, type ApprovedOutlineHeading } from './applyApprovedOutline';

/** Shared by collectApprovedOutline — instruction lists must not repeat a line. */
function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] || char);
}

export function reviewOutlineToHtml(outline: ApprovedOutlineHeading[]): string {
  return outline.map((item) => {
    const level = Math.min(4, Math.max(1, Number(item.level) || 2));
    const heading = `<h${level}>${escapeHtml(item.text)}</h${level}>`;
    if (level === 1) return heading;
    const instructions = item.instructions?.length
      ? `<ul>${item.instructions.map((instruction) => `<li>${escapeHtml(instruction)}</li>`).join('')}</ul>`
      : '<p></p>';
    // No per-section "Target length: ~N words". The reference brief carries no such line —
    // it states length inside the instruction that needs it ("2-3 akapity", "lista 6-8
    // objawów") and leaves the totals to the global structure targets. The number is not
    // lost: applyApprovedOutline reads `targetWords ?? base.expectedWords`, so a section
    // without one keeps the planner's own budget.
    return `${heading}${instructions}`;
  }).join('');
}

/**
 * Legacy marker. `Target length: ~N words` used to be emitted once per section, and
 * articles written before autosave was suspended during review still carry it inside
 * `articles.content` — this is what rescues those.
 *
 * New outlines no longer emit it, and are recognised by the other branch of
 * `isOutlineAwaitingReview`: review suspends autosave, so a draft awaiting review has an
 * empty `content` and a planner bundle in `score_data`.
 *
 * The live document is checked, not just the stored one, so this cannot rely on `content`
 * being empty: while the reviewer is reading, the outline IS the editor's document.
 */
const TARGET_LENGTH_LINE = /Target length:\s*~\s*\d+\s*words/i;

/** Every H2, and every H2 whose next element is its instruction list. */
const HEADING = /<h2[^>]*>/gi;
const HEADING_THEN_LIST = /<h2[^>]*>.*?<\/h2>\s*<ul[^>]*>/gis;
/** A paragraph carrying any text at all. reviewOutlineToHtml only ever emits `<p></p>`. */
const PARAGRAPH_WITH_TEXT = /<p[^>]*>(?!\s*<\/p>)[\s\S]*?\S[\s\S]*?<\/p>/i;

/**
 * Two ways in, because the format changed and old drafts did not.
 *
 * Legacy: the `Target length: ~N words` line every section used to carry. Articles saved
 * before autosave was suspended during review still hold it inside `articles.content`.
 *
 * Current: the exact shape `reviewOutlineToHtml` produces — every H2 followed by its
 * instruction list, and not one paragraph with text in it, because that renderer emits
 * only headings, lists and empty `<p></p>`.
 *
 * Both conditions are required. A "no paragraph longer than 160 characters" test was too
 * loose: a short, list-heavy article passed it, and being misread as an outline suspends
 * autosave and presents the finished article as planning instructions. Demanding that
 * EVERY heading has a list, and that no paragraph has any text, is a property of our own
 * generated document rather than a guess about how long prose tends to be.
 */
export function isReviewOutlineHtml(html: string): boolean {
  const doc = html || '';
  if (TARGET_LENGTH_LINE.test(doc)) return true;
  if (PARAGRAPH_WITH_TEXT.test(doc)) return false;
  const headings = (doc.match(HEADING) || []).length;
  if (headings === 0) return false;
  return (doc.match(HEADING_THEN_LIST) || []).length === headings;
}

function nodeText(node: JSONContent): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content || []).map(nodeText).join(' ').replace(/\s+/g, ' ').trim();
}

function instructionTexts(node: JSONContent): string[] {
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return (node.content || []).map(nodeText).map((text) => text.trim()).filter(Boolean);
  }
  const text = nodeText(node).trim();
  return text ? [text] : [];
}

export function collectApprovedOutline(doc: JSONContent): ApprovedOutlineHeading[] {
  const outline: ApprovedOutlineHeading[] = [];
  let current: ApprovedOutlineHeading | null = null;
  for (const node of doc.content || []) {
    if (node.type === 'heading') {
      const text = nodeText(node).trim();
      if (text) {
        const heading: ApprovedOutlineHeading = {
          level: Number(node.attrs?.level) || 2,
          text,
        };
        outline.push(heading);
        current = heading.level >= 2 ? heading : null;
      }
    } else if (current) {
      for (const text of instructionTexts(node)) {
        const target = text.match(/^Target length:\s*~?(\d+)\s*words?$/i);
        if (target) {
          current.targetWords = Number(target[1]);
        } else {
          current.instructions = unique([...(current.instructions || []), text]);
        }
      }
    }
  }
  return outline;
}

/**
 * What the reviewer should see when they open (or re-open) outline review, in order of
 * authority:
 *
 * 1. their own saved edits — nothing may overwrite those;
 * 2. the LLM brief written by briefWriter and persisted by content-plan.
 *
 * There is no third option any more. Rebuilding an outline mechanically from the bundle
 * produced "Pokryj <heading> z przypisanymi claims" followed by sentences scraped
 * verbatim off competitor pages, and it ran on every re-entry because the brief was
 * never persisted. Returning nothing instead makes the caller ask for a real brief.
 */
export function outlineForReview(opts: {
  approvedOutline: unknown;
  brief?: unknown;
}): ApprovedOutlineHeading[] {
  const saved = parseApprovedOutline(opts.approvedOutline);
  if (saved.length) return saved;
  return parseApprovedOutline(opts.brief);
}
