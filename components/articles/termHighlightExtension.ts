// TipTap/ProseMirror extension that underlines NLP entity terms inline (view-only
// decorations, never saved into content). Colour reflects coverage (green = at/over
// target, yellow = partial, red = unused) and the title carries the usage hint.
// Matching is inflection-tolerant (same logic as the content score), longest phrase
// wins on overlaps so "pozycjonowanie strony" beats "pozycjonowanie".
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { findTermRangesBatch, termCoverage, termUsageHint } from '../../lib/contentScore';

export type HlTerm = { term: string; current_count?: number; target_count: number };

export const termHighlightKey = new PluginKey('termHighlight');

interface Options {
  getTerms: () => HlTerm[];
  getEnabled: () => boolean;
}

const covClass = (t: HlTerm): string => `term-hl term-hl-${termCoverage(t)}`;

export const TermHighlight = Extension.create<Options>({
  name: 'termHighlight',

  addOptions() {
    return { getTerms: () => [], getEnabled: () => false };
  },

  addProseMirrorPlugins() {
    const { options } = this;
    return [
      new Plugin({
        key: termHighlightKey,
        props: {
          decorations(state) {
            if (!options.getEnabled()) return DecorationSet.empty;
            const terms = options.getTerms().filter((t) => t.term);
            if (!terms.length) return DecorationSet.empty;
            // Longer phrases first so they win overlap resolution.
            const ordered = [...terms].sort((a, b) => b.term.split(/\s+/).length - a.term.split(/\s+/).length);
            const orderedStrings = ordered.map((t) => t.term);

            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              const batch = findTermRangesBatch(node.text, orderedStrings);
              const occupied: Array<[number, number]> = [];
              batch.forEach((res, i) => {
                if (!res.ranges.length) return;
                const t = ordered[i];
                const cls = covClass(t);
                const title = termUsageHint(t);
                for (const [s, e] of res.ranges) {
                  if (occupied.some(([os, oe]) => s < oe && e > os)) continue; // skip overlaps
                  occupied.push([s, e]);
                  decos.push(Decoration.inline(pos + s, pos + e, { class: cls, 'data-term-tip': title }));
                }
              });
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
