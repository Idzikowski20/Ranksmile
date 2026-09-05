import { diffWordsWithSpace, diffChars } from 'diff';

export type DiffSeg = { type: 'equal' | 'added' | 'removed'; text: string };

// Adjacent removed+added word pairs are char-sub-diffed only when their common
// prefix covers at least this fraction of the shorter word — keeps unrelated
// substitutions as whole tokens while expanding near-identical inflections.
const CHAR_SUB_DIFF_MIN_PREFIX_RATIO = 0.8;

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
         if (shorter > 0 && prefix >= 3 && prefix / shorter >= CHAR_SUB_DIFF_MIN_PREFIX_RATIO) {
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

// Word-level diff between two article HTML versions, used by the "Compare versions" modal.
// Pure functions (no DOM) so they're easy to reason about and test.

export type WordSeg = { type: 'equal' | 'added' | 'removed'; text: string };

export type DiffBlock = {
   tag: string; // h1 | h2 | h3 | h4 | p | li | blockquote
   status: 'equal' | 'added' | 'removed' | 'changed';
   /** Segments for the ORIGINAL (left) pane — null when the block only exists in NEW. */
   left: WordSeg[] | null;
   /** Segments for the NEW (right) pane — null when the block only exists in ORIGINAL. */
   right: WordSeg[] | null;
};

type Block = { tag: string; text: string };

function decodeEntities(s: string): string {
   return s
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&ldquo;|&rdquo;/g, '"')
      .replace(/&mdash;/g, '—');
}

/** Strip inline tags, decode entities, collapse whitespace → plain block text. */
function stripInline(s: string): string {
   return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Flatten HTML into an ordered list of block-level {tag, text}. Images/tables are skipped
 *  (the diff is about prose structure; binary/layout nodes don't word-diff usefully). */
function parseBlocks(html: string): Block[] {
   const blocks: Block[] = [];
   const re = /<(h1|h2|h3|h4|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
   let m: RegExpExecArray | null = re.exec(html);
   while (m !== null) {
      const tag = m[1].toLowerCase();
      const text = stripInline(m[2]);
      if (text) blocks.push({ tag, text });
      m = re.exec(html);
   }
   return blocks;
}

/** Split into words and whitespace runs so re-joining segments preserves spacing. */
function tokenize(text: string): string[] {
   return text.match(/\s+|[^\s]+/g) || [];
}

function pushSeg(arr: WordSeg[], type: WordSeg['type'], text: string): void {
   const last = arr[arr.length - 1];
   if (last && last.type === type) last.text += text;
   else arr.push({ type, text });
}

/** LCS word diff of two plain strings → segment lists for the left and right panes. */
export function diffWords(aText: string, bText: string): { left: WordSeg[]; right: WordSeg[] } {
   const a = tokenize(aText);
   const b = tokenize(bText);
   const n = a.length;
   const m = b.length;
   // The LCS uses an (n+1)×(m+1) matrix. For a pathologically long single block, that allocation
   // explodes — degrade gracefully to a whole-block remove/add instead of a word-level diff.
   if (n * m > 1_000_000) {
      return {
         left: aText ? [{ type: 'removed', text: aText }] : [],
         right: bText ? [{ type: 'added', text: bText }] : [],
      };
   }
   // dp[i][j] = LCS length of a[i:], b[j:]
   const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
   for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
         dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
   }
   const left: WordSeg[] = [];
   const right: WordSeg[] = [];
   let i = 0;
   let j = 0;
   while (i < n && j < m) {
      if (a[i] === b[j]) { pushSeg(left, 'equal', a[i]); pushSeg(right, 'equal', b[j]); i += 1; j += 1; } else if (dp[i + 1][j] >= dp[i][j + 1]) { pushSeg(left, 'removed', a[i]); i += 1; } else { pushSeg(right, 'added', b[j]); j += 1; }
   }
   while (i < n) { pushSeg(left, 'removed', a[i]); i += 1; }
   while (j < m) { pushSeg(right, 'added', b[j]); j += 1; }
   return { left, right };
}

/** Token-overlap similarity (0–1) — decides whether a removed+added block pair is the same
 *  block reworded (→ word diff) vs two unrelated blocks (→ separate removed/added rows). */
function similar(a: string, b: string): number {
   const A = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
   const B = b.toLowerCase().split(/\s+/).filter(Boolean);
   if (!A.size || !B.length) return 0;
   let hits = 0;
   for (const w of B) if (A.has(w)) hits += 1;
   return hits / Math.max(A.size, B.length);
}

/** Block-level alignment (LCS on tag+text) → rows; consecutive removed+added of the same tag
 *  and high similarity collapse into a single 'changed' row carrying a word-level diff. */
export function diffBlocks(originalHtml: string, newHtml: string): DiffBlock[] {
   const O = parseBlocks(originalHtml);
   const N = parseBlocks(newHtml);
   const key = (x: Block) => `${x.tag}\n${x.text}`;
   const n = O.length;
   const m = N.length;
   const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
   for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
         dp[i][j] = key(O[i]) === key(N[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
   }
   const ops: Array<{ type: 'equal' | 'removed' | 'added'; o?: Block; n?: Block }> = [];
   let i = 0;
   let j = 0;
   while (i < n && j < m) {
      if (key(O[i]) === key(N[j])) { ops.push({ type: 'equal', o: O[i], n: N[j] }); i += 1; j += 1; } else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'removed', o: O[i] }); i += 1; } else { ops.push({ type: 'added', n: N[j] }); j += 1; }
   }
   while (i < n) { ops.push({ type: 'removed', o: O[i] }); i += 1; }
   while (j < m) { ops.push({ type: 'added', n: N[j] }); j += 1; }

   const out: DiffBlock[] = [];
   for (let k = 0; k < ops.length; k += 1) {
      const op = ops[k];
      const next = ops[k + 1];
      if (op.type === 'removed' && op.o && next?.type === 'added' && next.n
         && next.n.tag === op.o.tag && similar(op.o.text, next.n.text) > 0.3) {
         const w = diffWords(op.o.text, next.n.text);
         out.push({ tag: op.o.tag, status: 'changed', left: w.left, right: w.right });
         k += 1; // consume the paired 'added'
         continue;
      }
      if (op.type === 'equal' && op.o && op.n) {
         out.push({ tag: op.o.tag, status: 'equal', left: [{ type: 'equal', text: op.o.text }], right: [{ type: 'equal', text: op.n.text }] });
      } else if (op.type === 'removed' && op.o) {
         out.push({ tag: op.o.tag, status: 'removed', left: [{ type: 'removed', text: op.o.text }], right: null });
      } else if (op.type === 'added' && op.n) {
         out.push({ tag: op.n.tag, status: 'added', left: null, right: [{ type: 'added', text: op.n.text }] });
      }
   }
   return out;
}
