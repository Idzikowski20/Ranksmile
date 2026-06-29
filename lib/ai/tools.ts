import { tool } from 'ai';
import { z } from 'zod';
import type * as cheerio from 'cheerio';
import { countOccurrences } from '../contentScore';
import { scoreContent } from '../seo/scoreContentClient';
import { reindexSids, buildOutline, sanitizeFragment } from './workingDoc';
import type { ToolCtx } from './types';

const MAX_WRITES = 12; // cap on write-tool executions per turn

// Phrasing-only containers can't legally hold block-level children; replacing
// their inner HTML with a block creates invalid nesting (e.g. <p><h2>…</h2></p>)
// that the browser/Tiptap silently mangles.
const PHRASING_ONLY = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dt', 'figcaption']);
const BLOCK_TAG_RE = /<(p|div|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|blockquote|section|article|figure|pre|hr)[\s/>]/i;
function wouldNestBlock(tag: string, html: string): boolean {
  return PHRASING_ONLY.has(tag.toLowerCase()) && BLOCK_TAG_RE.test(html);
}

function workingText($: cheerio.CheerioAPI): string {
  return $.root().text().replace(/\s+/g, ' ').trim();
}

export function buildTools(ctx: ToolCtx) {
  return {
    read_block: tool({
      description: 'Get the current tag, text, and exact inner HTML of a block by its sid. Read a block before editing it so you replace the right content accurately (essential for lists and tables).',
      inputSchema: z.object({ sid: z.number().int() }),
      execute: async ({ sid }) => {
        const el = ctx.$(`[data-sid="${sid}"]`);
        if (el.length === 0) return { ok: false, summary: `sid ${sid} not found` };
        const node = el.get(0) as { tagName?: string; name?: string } | undefined;
        return {
          sid,
          tag: node?.tagName || node?.name || '?',
          text: el.text().trim(),
          html: el.html() || '',          // inner HTML (for op:'replace')
          outerHtml: ctx.$.html(el) || '', // whole block incl. its own tag
        };
      },
    }),

    get_outline: tool({
      description: 'Get the current article outline (one line per block with its sid). Call this after edits to see the up-to-date structure before making more edits.',
      inputSchema: z.object({}),
      execute: async () => ({ outline: buildOutline(ctx.$) }), // pure read — never renumbers
    }),

    get_content_score: tool({
      description:
        'Get the current SEO content score: word/heading/paragraph counts vs targets and per-NLP-term coverage (missing/low/ok/overuse). Call this to see how the article scores right now.',
      inputSchema: z.object({}),
      execute: async () => {
        const text = workingText(ctx.$);
        const words = text.split(/\s+/).filter(Boolean).length;
        const sd = ctx.scoreData;
        const terms = (sd?.terms || []).map((t) => {
          const current = countOccurrences(text, t.term);
          const min = Math.max(1, Math.round(t.target_count * 0.7));
          const max = Math.round(t.target_count * 1.5);
          const status = current === 0 ? 'missing' : current < min ? 'low' : current > max ? 'overuse' : 'ok';
          return { term: t.term, current, target: t.target_count, status };
        });
        return {
          words: { current: words, target: sd?.words_target ?? null },
          headings: { current: ctx.$('h1,h2,h3,h4').length, target: sd?.headings_target ?? null },
          paragraphs: { current: ctx.$('p').length, target: sd?.paragraphs_target ?? null },
          terms,
        };
      },
    }),

    list_missing_terms: tool({
      description: 'List NLP terms the article under-uses (current count below the minimum), biggest gap first.',
      inputSchema: z.object({ limit: z.number().int().positive().max(50).optional() }),
      execute: async ({ limit }) => {
        const text = workingText(ctx.$);
        const gaps = (ctx.scoreData?.terms || [])
          .map((t) => ({ term: t.term, current: countOccurrences(text, t.term), target: t.target_count }))
          .filter((t) => t.current < Math.max(1, Math.round(t.target * 0.7)))
          .sort((a, b) => (b.target - b.current) - (a.target - a.current));
        return { missing: gaps.slice(0, limit ?? 10) };
      },
    }),

    get_ranking_signals: tool({
      description: 'Run the ranking-signal analysis and return the overall ranking score plus the weakest signals with fix recommendations.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const r: any = await scoreContent(
            ctx.$.html(), ctx.keyword, (ctx.scoreData as any) || {}, ctx.articleTitle, ctx.articleMetaDescription,
          );
          const weakest = [...(r?.ranking_signals?.signals || [])]
            .sort((a: any, b: any) => a.score - b.score)
            .slice(0, 5)
            .map((s: any) => ({ name: s.name, score: s.score, recommendation: s.recommendation }));
          return { ranking_score: r?.ranking_score ?? null, weakest_signals: weakest };
        } catch (e: any) {
          return { ok: false, error: `ranking analysis unavailable: ${e?.message || 'error'}` };
        }
      },
    }),

    list_internal_link_targets: tool({
      description: 'List internal articles you can link to. Optional query filters by title substring.',
      inputSchema: z.object({ query: z.string().optional() }),
      execute: async ({ query }) => {
        const q = (query || '').toLowerCase().trim();
        const targets = ctx.internalArticles
          .filter((a) => !q || a.title.toLowerCase().includes(q))
          .slice(0, 20)
          .map((a) => ({ title: a.title, url: a.url }));
        return { targets };
      },
    }),
  };
}
