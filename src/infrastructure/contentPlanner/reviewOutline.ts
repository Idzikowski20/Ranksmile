import type { JSONContent } from '@tiptap/core';
import { parseApprovedOutline, type ApprovedOutlineHeading } from '@/src/infrastructure/contentPlanner/applyApprovedOutline';

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

/**
 * The blocks reviewOutlineToHtml emits, matched in document order.
 *
 * `<br>` is deliberately NOT here. The renderer never emits one, so a standalone break
 * means the document came from somewhere else — it used to be tolerated as a "skip"
 * token and filtered out before pairing, which let `<h2>…</h2><br><ul>…</ul>` and other
 * shapes the renderer cannot produce pass as an outline and suspend autosave. Leaving it
 * out means it survives as leftover and disqualifies the document, which is the answer.
 * Breaks INSIDE a heading or list item are part of that block's match and unaffected.
 */
const OUTLINE_BLOCK = /<(h[1-4])[^>]*>[\s\S]*?<\/\1>|<ul[^>]*>[\s\S]*?<\/ul>|<p[^>]*>\s*<\/p>/gi;

type OutlineToken = 'title' | 'heading' | 'body';

function tokenOf(block: string): OutlineToken {
  if (/^<h1/i.test(block)) return 'title';
  if (/^<h[2-4]/i.test(block)) return 'heading';
  return 'body';
}

/**
 * Two ways in, because the format changed and old drafts did not.
 *
 * Legacy: the `Target length: ~N words` line every section used to carry. Articles saved
 * before autosave was suspended during review still hold it inside `articles.content`.
 *
 * Current: the document matches the shape reviewOutlineToHtml produces, in order — an
 * optional H1 title, then one or more sections, each a heading immediately followed by
 * its instruction list (or the empty `<p></p>` a section with no bullets renders) — and
 * nothing outside those blocks.
 *
 * The order is the point. Two weaker versions failed in opposite directions: counting
 * heading/list PAIRS let a later section's list satisfy an earlier heading, and merely
 * checking that nothing ELSE is present accepted any arrangement of headings and lists,
 * so a genuine heading-and-list article with no prose was read as an outline — which
 * suspends autosave over a finished article and loses the edits made after it.
 */
export function isReviewOutlineHtml(html: string): boolean {
  const doc = html || '';
  if (TARGET_LENGTH_LINE.test(doc)) return true;

  const blocks = doc.match(OUTLINE_BLOCK) || [];
  // Anything the renderer could not have produced — a paragraph with text, a table, an
  // image — means this is an article, whatever the rest looks like.
  if (doc.replace(OUTLINE_BLOCK, '').replace(/&nbsp;/gi, ' ').trim()) return false;

  const tokens = blocks.map(tokenOf);
  let i = 0;
  if (tokens[i] === 'title') i += 1;
  let sections = 0;
  while (i < tokens.length) {
    if (tokens[i] !== 'heading' || tokens[i + 1] !== 'body') return false;
    sections += 1;
    i += 2;
  }
  return sections > 0;
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
