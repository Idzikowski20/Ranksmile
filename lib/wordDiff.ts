import { diffWordsWithSpace, diffChars } from 'diff';

export type DiffSeg = { type: 'equal' | 'added' | 'removed'; text: string };

/** Longest common prefix length of two strings. */
function commonPrefixLen(a: string, b: string): number {
   let i = 0;
   const len = Math.min(a.length, b.length);
   while (i < len && a[i] === b[i]) i++;
   return i;
}

/** Word-level diff of two PLAIN-TEXT strings → ordered segments (display only).
 *  Uses word-boundary diff as the primary strategy. Adjacent removed+added word
 *  pairs that share a long common prefix (≥ 80 % of the shorter word, ≥ 3 chars)
 *  are expanded with a character-level sub-diff so partial matches like "aplikacj"
 *  surface as equal segments. Pairs with a short overlap are kept as whole tokens.
 *  This is display-only — never used as a source of truth for accept/reject.
 */
export function wordDiffSegments(oldText: string, newText: string): DiffSeg[] {
   const raw = diffWordsWithSpace(oldText, newText).map((p) => ({
      type: (p.added ? 'added' : p.removed ? 'removed' : 'equal') as DiffSeg['type'],
      text: p.value,
   }));

   const result: DiffSeg[] = [];
   let i = 0;
   while (i < raw.length) {
      const cur = raw[i];
      if (cur.type === 'removed' && i + 1 < raw.length && raw[i + 1].type === 'added') {
         const next = raw[i + 1];
         const shorter = Math.min(cur.text.length, next.text.length);
         const prefix = commonPrefixLen(cur.text, next.text);
         // Sub-diff only when prefix is substantial (≥ 80 % of shorter, ≥ 3 chars)
         if (shorter > 0 && prefix >= 3 && prefix / shorter >= 0.8) {
            diffChars(cur.text, next.text).forEach((p) => {
               result.push({
                  type: (p.added ? 'added' : p.removed ? 'removed' : 'equal') as DiffSeg['type'],
                  text: p.value,
               });
            });
         } else {
            result.push(cur, next);
         }
         i += 2;
      } else {
         result.push(cur);
         i += 1;
      }
   }
   return result;
}

/** Render diff segments as inline HTML: removed = gray strikethrough, added = green. */
export function renderDiffHtml(segs: DiffSeg[]): string {
   return segs.map((s) => {
      const t = escapeHtml(s.text);
      if (s.type === 'equal') return t;
      if (s.type === 'removed') return `<span data-diff-type="removed" style="color:#9f9fa9;text-decoration:line-through">${t}</span>`;
      return `<span data-diff-type="added" style="background:rgba(26,178,94,0.18);border-radius:2px">${t}</span>`;
   }).join('');
}

function escapeHtml(s: string): string {
   return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
