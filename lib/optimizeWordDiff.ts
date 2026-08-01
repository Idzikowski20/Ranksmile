import { diffBlocks, wordDiffSegments, type DiffSeg } from './wordDiff';

export type { DiffSeg };
export { wordDiffSegments };

/** AO review styling: removed = gray strikethrough, added = green underline. */
export function renderDiffHtml(segs: DiffSeg[]): string {
   return segs.map((s) => {
      const t = escapeHtml(s.text);
      if (s.type === 'equal') return t;
      if (s.type === 'removed') {
         return `<span data-diff-type="removed" style="color:#9f9fa9;text-decoration:line-through;opacity:0.85">${t}</span>`;
      }
      return `<span data-diff-type="added" style="color:#18181b;background:rgba(26,178,94,0.14);border-radius:2px;text-decoration:underline;text-decoration-color:#1AB25E;text-underline-offset:2px;text-decoration-thickness:2px">${t}</span>`;
   }).join('');
}

/**
 * Block-aware AO review diff: keeps H2/H3/P/li structure like the editor,
 * with word-level add/remove marks inside each block (not one flattened wall).
 */
export function renderStructuredDiffHtml(oldHtml: string, newHtml: string): string {
   const blocks = diffBlocks(oldHtml || '', newHtml || '');
   if (blocks.length === 0) {
      const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return renderDiffHtml(wordDiffSegments(strip(oldHtml || ''), strip(newHtml || '')));
   }

   return blocks.map((b) => {
      const oldText = (b.left || []).map((s) => s.text).join('');
      const newText = (b.right || []).map((s) => s.text).join('');
      let segs: DiffSeg[];
      if (b.status === 'equal') {
         segs = [{ type: 'equal', text: newText || oldText }];
      } else if (b.status === 'added') {
         segs = [{ type: 'added', text: newText }];
      } else if (b.status === 'removed') {
         segs = [{ type: 'removed', text: oldText }];
      } else {
         segs = wordDiffSegments(oldText, newText);
      }
      return `<${b.tag}>${renderDiffHtml(segs)}</${b.tag}>`;
   }).join('');
}

function escapeHtml(s: string): string {
   return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
