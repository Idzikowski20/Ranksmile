import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess, ensureUserTenancy } from '../../../lib/tenancy';
import { getOrgUsage5h, recordAiTokens, AI_TOKEN_LIMIT_5H } from '../../../lib/aiTokenUsage';
import { splitSections, normalizeHtmlForDiff } from '../../../lib/articleSections';
import type { Section } from '../../../lib/articleSections';
import { buildSectionEvent } from '../../../lib/optimizeSectionEvents';
import { computeMissingTerms, stripFences, isUsableEdit, shouldChargeCredit } from '../../../lib/optimizeSectionEdit';
import type { SectionResult } from '../../../components/articles/optimizeStore';
import type { ScoreData } from '../../../lib/contentScore';
import { buildArticleContext } from '../../../lib/articleContext';
import { buildGuidelines } from '../../../lib/recommendationEngine';
import { buildOptimizationPlan } from '../../../lib/optimizationPlanner';
import type { Plan, PlanStep } from '../../../lib/optimizationPlanner';
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

/** No-articleId (unsaved draft) fallback — byte-for-byte reproduction of today's optimizer:
 *  ONE global system prompt for every section, from article-wide missing terms, no routing/ROI/skip. */
function legacyPlan(sections: Section[], scoreData: ScoreData | undefined, content: string): Plan {
   const terms = computeMissingTerms(scoreData, content);
   const sys = buildSystemPrompt(terms);
   const steps: PlanStep[] = sections.map((s) => ({
      sectionId: s.id,
      index: s.index,
      headingText: s.headingText,
      html: s.html,
      focus: 'seo-terms',
      systemPrompt: sys,
      guidelines: [],
      missingTerms: terms,
      estimatedTokens: 0,
      expectedLift: 0,
      reason: 'Legacy: no articleId',
   }));
   return { steps, estimatedTokens: 0, trimmed: false, ignoredLift: 0, rationale: 'legacy' };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { content, articleId, scoreData } = req.body as {
      content: string;
      articleId?: number;
      scoreData?: ScoreData;
   };
   if (!content) return res.status(400).json({ error: 'content is required' });

   let userId: string | null = null;
   try { userId = await getCurrentUserId(req, res); } catch { userId = null; }

   if (articleId !== undefined) {
      if (!(await assertArticleAccess(userId, Number(articleId)))) {
         return res.status(403).json({ error: 'Access denied.' });
      }
   }

   // Credit gate: block before any SSE output if the org's 5h token pool is exhausted.
   let orgId: number | null = null;
   if (userId != null) {
      try { orgId = (await ensureUserTenancy(String(userId))).orgId; } catch { orgId = null; }
   }
   if (orgId != null) {
      const usage = await getOrgUsage5h(orgId);
      if (usage.over) {
         return res.status(429).json({ error: 'org_limit', resetsAt: usage.resetsAt, used: usage.used, limit: usage.limit });
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
   const onClose = () => { aborted = true; controller.abort(); };
   req.on('close', onClose);

   try {
      const sections = splitSections(content);
      sse(res, 'meta', { total: sections.length, sections: sections.map((s) => ({ sectionId: s.id, index: s.index, headingText: s.headingText })) });

      // Server-side context + plan assembly. articleId present -> Planner v2; absent (unsaved draft) -> legacyPlan.
      const ctx = articleId != null ? await buildArticleContext(Number(articleId)) : null;
      const snapshot = ctx?.coverage ?? null;
      const guidelines = snapshot ? buildGuidelines(snapshot, ctx ?? undefined) : [];

      const usage = orgId != null ? await getOrgUsage5h(orgId) : { used: 0, limit: AI_TOKEN_LIMIT_5H, resetsAt: 0, over: false };

      const plan: Plan = ctx
         ? buildOptimizationPlan({ sections, guidelines, context: ctx, budgetRemaining: usage.limit - usage.used })
         : legacyPlan(sections, scoreData, content);

      if (plan.trimmed) sse(res, 'meta', { trimmed: true, ignoredLift: plan.ignoredLift });

      let changedCount = 0;
      let aiTokens = 0;

      try {
         for (const step of plan.steps) {
            if (aborted) break;

            const section: Section = { id: step.sectionId, index: step.index, headingText: step.headingText, html: step.html };

            if (step.focus === 'skip') {
               sse(res, 'section', buildSectionEvent(section, { oldHtml: step.html, newHtml: step.html, changed: false }));
               continue;
            }

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
                           { role: 'system', content: step.systemPrompt },
                           { role: 'user', content: `Improve this section:\n\n${section.html}` },
                        ],
                     }),
                     signal: controller.signal,
                  });
                  if (!aiRes.ok) throw new Error(`HTTP ${aiRes.status}`);
                  const data = await aiRes.json();
                  aiTokens += data.usage?.total_tokens || 0;
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
      } finally {
         // B cubic-P1: record spend even on a mid-run throw (mirrors deep-analysis.ts finally).
         if (!aborted && orgId != null && shouldChargeCredit(changedCount, aiTokens)) {
            await recordAiTokens(orgId, aiTokens);
         }
      }

      if (aborted) return;

      // Charge the shared pool only when the run produced changes ("no changes ⇒ no credit deducted").
      // shouldChargeCredit is deterministic on changedCount/aiTokens, so this flag can't diverge
      // from the spend already recorded in the finally above.
      const creditDeducted = orgId != null && shouldChargeCredit(changedCount, aiTokens);

      sse(res, 'done', { changedCount, total: plan.steps.length, promptVersion: PROMPT_VERSION, creditDeducted, trimmed: plan.trimmed, ignoredLift: plan.ignoredLift });
   } catch (error) {
      if (!aborted) sse(res, 'error', { message: getErrorMessage(error) || 'Request failed' });
   } finally {
      req.off('close', onClose);
      res.end();
   }
}
