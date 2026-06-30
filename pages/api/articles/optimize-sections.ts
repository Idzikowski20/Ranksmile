import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { splitSections, normalizeHtmlForDiff } from '../../../lib/articleSections';
import { buildSectionEvent } from '../../../lib/optimizeSectionEvents';
import { computeMissingTerms, stripFences, isUsableEdit } from '../../../lib/optimizeSectionEdit';
import type { SectionResult } from '../../../components/articles/optimizeStore';
import type { ScoreData } from '../../../lib/contentScore';
import { getErrorMessage } from '../../../lib/errors';

export const config = { maxDuration: 300, api: { responseLimit: '10mb' } };

const PROMPT_VERSION = 'ao-sections-v1';

function sse(res: NextApiResponse, event: string, data: object) {
   res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
   if (typeof (res as any).flush === 'function') (res as any).flush();
}

/** Per-section restrained editing checklist. `missingTerms` are woven in verbatim where natural. */
function buildSystemPrompt(missingTerms: string[]): string {
   const termList = missingTerms.map((t) => `"${t}"`).join(', ');
   const termsBlock = missingTerms.length
      ? `\n- Weave in these MISSING NLP terms VERBATIM where natural (exact form, no inflection/synonyms): ${termList}`
      : '';
   return `You are an expert SEO content editor making MINIMAL, surgical edits to ONE section of an HTML article.

RULES:
- Apply MINIMAL surgical edits — refine, do not rewrite${termsBlock}
- Tighten weak sentences and remove AI-sounding filler ("It's worth noting that", "In today's world", "Furthermore", "In conclusion", "Delve into")
- Keep the SAME LANGUAGE as the input (auto-detect — do NOT translate)
- Preserve EVERY heading, <a> link, <img>, and list EXACTLY as written
- Do NOT remove or shorten existing sentences — only refine or expand
- Keep each paragraph between ~40 and ~80 words

OUTPUT: ONLY the section's raw HTML. No markdown code fences, no commentary.`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { content, articleId, scoreData } = req.body as {
      content: string;
      articleId?: number;
      scoreData?: ScoreData;
      keyword?: string;
   };
   if (!content) return res.status(400).json({ error: 'content is required' });

   if (articleId !== undefined) {
      const userId = await getCurrentUserId(req, res);
      if (!(await assertArticleAccess(userId, Number(articleId)))) {
         return res.status(403).json({ error: 'Access denied.' });
      }
   }

   res.setHeader('Content-Type', 'text/event-stream');
   res.setHeader('Cache-Control', 'no-cache, no-transform');
   res.setHeader('Connection', 'keep-alive');
   res.setHeader('X-Accel-Buffering', 'no');
   res.setHeader('Content-Encoding', 'identity');
   res.status(200);
   if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();
   res.write(':ok\n\n');

   const apiKey = process.env.DEEPSEEK_API_KEY;
   if (!apiKey) {
      sse(res, 'error', { message: 'DEEPSEEK_API_KEY not configured' });
      return res.end();
   }

   // Abort on client disconnect — stop mid-run and emit nothing further.
   const controller = new AbortController();
   let aborted = false;
   req.on('close', () => { aborted = true; controller.abort(); });

   try {
      const sections = splitSections(content);
      sse(res, 'meta', { total: sections.length, sections: sections.map((s) => ({ sectionId: s.id, index: s.index, headingText: s.headingText })) });

      // Article-wide missing/underused NLP terms — computed ONCE, passed into every section's prompt.
      const missingTerms = computeMissingTerms(scoreData, content);
      const systemPrompt = buildSystemPrompt(missingTerms);

      let changedCount = 0;

      for (const section of sections) {
         if (aborted) break;

         let newHtml = section.html;
         const MAX_ATTEMPTS = 3; // 1 initial + 2 retries
         for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
            try {
               const aiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                  body: JSON.stringify({
                     model: 'deepseek-chat',
                     max_tokens: 4000,
                     temperature: 0.3,
                     messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Improve this section:\n\n${section.html}` },
                     ],
                  }),
                  signal: controller.signal,
               });
               if (!aiRes.ok) throw new Error(`HTTP ${aiRes.status}`);
               const data = await aiRes.json();
               const cleaned = stripFences(data.choices?.[0]?.message?.content || '');
               if (isUsableEdit(cleaned)) newHtml = cleaned; // else keep original (empty/garbage)
               break; // success — stop retrying
            } catch (error) {
               // An aborted run is not a retriable failure — break out and stop.
               if (aborted || (error instanceof Error && error.name === 'AbortError')) break;
               if (attempt === MAX_ATTEMPTS) newHtml = section.html; // all attempts failed → skip
            }
         }

         if (aborted) break;

         const changed = normalizeHtmlForDiff(section.html) !== normalizeHtmlForDiff(newHtml);
         const result: SectionResult = { oldHtml: section.html, newHtml, changed };
         if (changed) changedCount += 1;
         sse(res, 'section', buildSectionEvent(section, result));
      }

      if (aborted) return res.end();
      sse(res, 'done', { changedCount, total: sections.length, promptVersion: PROMPT_VERSION });
   } catch (error) {
      if (!aborted) sse(res, 'error', { message: getErrorMessage(error) || 'Request failed' });
   }

   res.end();
}
