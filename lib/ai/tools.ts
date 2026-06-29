import { tool } from 'ai';
import { z } from 'zod';
import type * as cheerio from 'cheerio';
import { countOccurrences } from '../contentScore';
import { scoreContent } from '../seo/scoreContentClient';
import { callSidecar } from '../sidecar';
import { computeAiSearchScore } from '../aiSearchScore';
import type { AiVisibilitySummary } from '../aiSearchScore';
import { reindexSids, buildOutline, sanitizeFragment, stripSids } from './workingDoc';
import { resolveArticleSeoMeta } from './articleMeta';
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

// ms — heavy SERP/scrape ops; shorter than the 60s default, with the Stop
// button + per-run cache as the responsiveness safety net.
const SIDECAR_TIMEOUT = 30_000;

// Resolve the article's SEO meta once per agent run (cached on ctx.cache.seoMeta).
async function getSeoMeta(ctx: ToolCtx) {
  if (!ctx.cache.seoMeta && ctx.articleId != null) {
    ctx.cache.seoMeta = await resolveArticleSeoMeta(ctx.articleId);
  }
  return ctx.cache.seoMeta;
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

    get_headings_outline: tool({
      description: 'Get the article\'s own heading hierarchy (H1–H4) as a nested outline. Pure read.',
      inputSchema: z.object({}),
      execute: async () => {
        const headings: Array<{ level: number; text: string }> = [];
        ctx.$('h1,h2,h3,h4').each((_i, el) => {
          const tag = (el as cheerio.Element).tagName || (el as { name?: string }).name || '';
          const level = Number(tag.replace('h', '')) || 1;
          const text = ctx.$(el).text().trim();
          if (text) headings.push({ level, text });
        });
        return { headings, outline: headings.map((h) => `${'  '.repeat(Math.max(0, h.level - 1))}${h.text}`).join('\n') };
      },
    }),

    get_ai_search_score: tool({
      description: 'AI-search visibility: how likely AI assistants cite this article for the keyword, plus extractability. Higher is better.',
      inputSchema: z.object({}),
      execute: async () => {
        if (ctx.cache.aiSearch) return ctx.cache.aiSearch;            // per-run cache
        if (ctx.articleId == null) return { ok: false, summary: 'article id unavailable' };
        try {
          const m = await getSeoMeta(ctx);
          const sc: any = await callSidecar('/ai-visibility', {
            keyword: ctx.keyword || m?.targetKeyword || '',
            own_domain: m?.domain || '',
            competitor_domains: m?.competitorDomains || [],
            // strip data-sid handles; AI-search uses HTML structure (headings/lists) but not our attrs
            article_content: `${ctx.articleTitle}\n${ctx.articleMetaDescription}\n${stripSids(ctx.$.html())}`,
          }, SIDECAR_TIMEOUT);
          const summary: AiVisibilitySummary = {
            prompts_total: sc.prompts_total || 0,
            prompts_cited: sc.prompts_cited || 0,
            competitor_citations: sc.competitor_citations || 0,
            extractability_score: sc.extractability_score || 0,
            citations: sc.citations || [],
          };
          const out = {
            score: computeAiSearchScore(summary),
            prompts_cited: summary.prompts_cited,
            prompts_total: summary.prompts_total,
            competitor_citations: summary.competitor_citations,
            extractability_score: summary.extractability_score,
          };
          ctx.cache.aiSearch = out;
          return out;
        } catch (e: any) {
          return { ok: false, error: `AI-search analysis unavailable: ${e?.message || 'error'}` };
        }
      },
    }),

    check_plagiarism: tool({
      description: 'Scan the article for plagiarism against the web; returns uniqueness %, the total number of flagged passages, and a few examples.',
      inputSchema: z.object({}),
      execute: async () => {
        if (ctx.cache.plagiarism) return ctx.cache.plagiarism;        // per-run cache
        if (ctx.articleId == null) return { ok: false, summary: 'article id unavailable' };
        try {
          const m = await getSeoMeta(ctx);
          const d: any = await callSidecar('/plagiarism', {
            text: ctx.$.root().text(),
            domain: m?.domain || '',
            language: m?.language || 'pl',
          }, SIDECAR_TIMEOUT);
          const out = {
            uniqueness: d.uniqueness ?? null,
            matched: d.matched ?? 0,        // TOTAL flagged passages (model can say "37 found, showing 3")
            checked: d.checked ?? 0,
            sample_matches: (d.matches || []).slice(0, 3).map((x: any) => ({ text: x.text, domain: x.domain, url: x.url })),
          };
          ctx.cache.plagiarism = out;
          return out;
        } catch (e: any) {
          return { ok: false, error: `plagiarism scan unavailable: ${e?.message || 'error'}` };
        }
      },
    }),

    fetch_competitor_outline: tool({
      description: 'People-Also-Ask questions and (optionally) competitor heading outlines for the keyword, to guide structure and coverage. PAA returns instantly; pass competitors:true to ALSO fetch live competitor outlines (slower SERP scrape).',
      inputSchema: z.object({ competitors: z.boolean().optional() }),
      execute: async ({ competitors }) => {
        const paa = ctx.scoreData?.paa_questions || [];
        const wantOutlines = competitors === true || paa.length === 0;
        let outlines: Array<{ title: string; url: string; headings_outline: string }> | undefined;
        if (wantOutlines) {
          if (ctx.cache.competitors) {
            outlines = ctx.cache.competitors as Array<{ title: string; url: string; headings_outline: string }>;
          } else {
            try {
              const m = ctx.articleId != null ? await getSeoMeta(ctx) : undefined;
              const d: any = await callSidecar('/competitor-outlines', { keyword: ctx.keyword, language: m?.language || 'pl', num: 5 }, SIDECAR_TIMEOUT);
              outlines = (d.competitors || []).slice(0, 5).map((c: any) => ({
                title: c.title,
                url: c.url,
                headings_outline: (c.headings || []).map((h: any) => `${'  '.repeat(Math.max(0, (h.level || 2) - 2))}${h.text}`).join('\n'),
              }));
              ctx.cache.competitors = outlines;
            } catch {
              outlines = undefined; // PAA still returned below; sidecar failure is non-fatal
            }
          }
        }
        return { paa_questions: paa, competitors: outlines, source: outlines ? 'live_serp+paa' : 'paa' };
      },
    }),

    apply_edit: tool({
      description:
        'Edit a block by its sid. op="replace" replaces the block\'s inner HTML; "append" inserts a new block AFTER it; "prepend" inserts a new block BEFORE it; "remove" deletes the block. For lists/tables, call read_block first then "replace" with the full new inner HTML. Returns the refreshed outline.',
      inputSchema: z.object({
        sid: z.number().int(),
        op: z.enum(['replace', 'append', 'prepend', 'remove']),
        html: z.string().optional(),
      }),
      execute: async ({ sid, op, html }) => {
        if (ctx.writeCount >= MAX_WRITES) return { ok: false, summary: 'edit limit reached for this turn' };
        const el = ctx.$(`[data-sid="${sid}"]`);
        if (el.length === 0) return { ok: false, summary: `sid ${sid} not found` };
        if (op !== 'remove' && !html) return { ok: false, summary: `html is required for op "${op}"` };
        const safe = html ? sanitizeFragment(html) : '';
        if (op === 'replace') {
          const node = el.get(0) as { tagName?: string; name?: string } | undefined;
          const tag = node?.tagName || node?.name || '';
          if (wouldNestBlock(tag, safe)) {
            return { ok: false, summary: `<${tag}> can't contain block-level HTML. Pass inline HTML only, or use op "append"/"prepend" to add sibling blocks, or "remove" then insert_section.` };
          }
        }
        if (op === 'replace') el.html(safe);
        else if (op === 'append') el.after(safe);
        else if (op === 'prepend') el.before(safe);
        else el.remove();
        ctx.htmlDirty = true;
        ctx.writeCount += 1;
        ctx.changelog.push({ tool: 'apply_edit', summary: `${op} on sid ${sid}` });
        return { ok: true, summary: `Applied ${op} to sid ${sid}`, outline: reindexSids(ctx.$) };
      },
    }),

    insert_section: tool({
      description:
        'Insert a new section (a heading plus body HTML) at a position. position="start"|"end" relative to the article; "after_sid"/"before_sid" relative to a block (requires sid). level is the heading level (2–4, default 2). Returns the refreshed outline.',
      inputSchema: z.object({
        heading: z.string(),
        html: z.string(),
        position: z.enum(['start', 'end', 'after_sid', 'before_sid']),
        sid: z.number().int().optional(),
        level: z.number().int().min(2).max(4).optional(),
      }),
      execute: async ({ heading, html, position, sid, level }) => {
        if (ctx.writeCount >= MAX_WRITES) return { ok: false, summary: 'edit limit reached for this turn' };
        const h = level ?? 2;
        const block = `<h${h}>${heading}</h${h}>\n${sanitizeFragment(html)}`;
        if (position === 'start') ctx.$.root().prepend(block);
        else if (position === 'end') ctx.$.root().append(block);
        else {
          if (sid == null) return { ok: false, summary: 'sid is required for after_sid/before_sid' };
          const el = ctx.$(`[data-sid="${sid}"]`);
          if (el.length === 0) return { ok: false, summary: `sid ${sid} not found` };
          if (position === 'after_sid') el.after(block);
          else el.before(block);
        }
        ctx.htmlDirty = true;
        ctx.writeCount += 1;
        ctx.changelog.push({ tool: 'insert_section', summary: `Inserted "${heading}" (${position})` });
        return { ok: true, summary: `Inserted section "${heading}"`, outline: reindexSids(ctx.$) };
      },
    }),

    set_meta: tool({
      description: 'Stage updated SEO meta tags (title and/or description). Does not change the article body; the client applies these on accept.',
      inputSchema: z.object({
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
      }),
      execute: async ({ metaTitle, metaDescription }) => {
        ctx.meta = {
          ...(ctx.meta || {}),
          ...(metaTitle != null ? { metaTitle } : {}),
          ...(metaDescription != null ? { metaDescription } : {}),
        };
        ctx.changelog.push({ tool: 'set_meta', summary: 'Updated meta tags' });
        return { ok: true, summary: 'Meta tags staged for apply' };
      },
    }),
  };
}
