import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess, ensureUserTenancy } from '../../../lib/tenancy';
import { getOrgUsage5h, recordAiTokens, AI_TOKEN_LIMIT_5H } from '../../../lib/aiTokenUsage';
import { splitSections, normalizeHtmlForDiff, joinSections } from '../../../lib/articleSections';
import type { Section } from '../../../lib/articleSections';
import { buildSectionEvent } from '../../../lib/optimizeSectionEvents';
import { computeMissingTerms, stripFences, isUsableEdit, shouldChargeCredit } from '../../../lib/optimizeSectionEdit';
import type { ScoreData } from '../../../lib/contentScore';
import { computeContentScore } from '../../../lib/contentScore';
import { computeOverallContentScore } from '../../../lib/aiSearchScore';
import { buildArticleContext } from '../../../lib/articleContext';
import type { ArticleContext } from '../../../lib/articleContext';
import { enrichNlpTermsIfNeeded, needsTermEnrichment } from '../../../lib/articleKeywordDiscovery';
import { filterUsefulNlpTerms } from '../../../lib/competitorTermCalibration';
import { termsForOptimize } from '../../../lib/mergeArticleTerms';
import { liveCoverageItems } from '../../../lib/liveCoverage';
import { computeCoverageScores } from '../../../lib/aiCoverage';
import { getArticleIdSql } from '../../../lib/articleSql';
import db from '../../../database/database';
import { buildGuidelines } from '../../../lib/recommendationEngine';
import { buildOptimizationPlan } from '../../../lib/optimizationPlanner';
import type { Plan, PlanStep } from '../../../lib/optimizationPlanner';
import {
  DEFAULT_MAX_ROUNDS,
  selectOptimizeMode,
  TARGET_AI,
  TARGET_SEO,
  type OptimizeMode,
} from '../../../lib/optimizeMode';
import {
  maxRoundsForPhase,
  resolveOptimizePhase,
  targetContentForPhase,
  type AoMeta,
} from '../../../lib/optimizeRunPhase';
import { getErrorMessage } from '../../../lib/errors';
import { queryOne } from '../../../lib/db/query';
import { flushSse, flushHeaders } from '../../../lib/types/api';

export const config = { maxDuration: 300, api: { responseLimit: '10mb' } };

const PROMPT_VERSION = 'ao-sections-v3';

function scoreSeo(html: string, scoreData: ScoreData | undefined, keyword: string): number {
   const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
   const wc = plain ? plain.split(/\s+/).length : 0;
   const hc = (html.match(/<h[1-6]/gi) || []).length;
   const pc = (html.match(/<p[\s>]/gi) || []).length;
   if (!scoreData) return 0;
   return computeContentScore(plain, wc, hc, scoreData, pc, undefined, html, keyword);
}

function scoreAiFromContext(ctx: ArticleContext | null, html: string, latestAiScore: number): number {
   if (ctx?.coverage?.items?.length) {
      const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const live = liveCoverageItems(ctx.coverage.items, plain, html);
      return computeCoverageScores(live, !!ctx.coverage.answersMainQuestionEarly).overall;
   }
   if (ctx?.scoreData?.ai_score != null) return ctx.scoreData.ai_score;
   return latestAiScore;
}

async function persistScoreDataTerms(
   articleId: number | undefined,
   nextScoreData: ScoreData,
   scoreData: ScoreData | undefined,
   res: NextApiResponse,
   previousCount: number,
): Promise<void> {
   if (!articleId || nextScoreData.terms.length <= previousCount) return;
   try {
      const articleIdSql = await getArticleIdSql();
      await db.query(
         `UPDATE articles SET score_data = ? WHERE ${articleIdSql} = ?`,
         { replacements: [JSON.stringify(nextScoreData), articleId] },
      );
   } catch { /* non-fatal */ }
   if (scoreData) Object.assign(scoreData, { terms: nextScoreData.terms });
   sse(res, 'terms', { terms: nextScoreData.terms });
}

function globalOptimizeBrief(ctx: ArticleContext, html: string, mode: OptimizeMode): string {
   const lines: string[] = [];
   if (mode !== 'ai-only') {
      const missing = computeMissingTerms(ctx.scoreData ?? undefined, html).slice(0, 30);
      if (missing.length) {
         lines.push(`Missing SEO entities (use verbatim where natural): ${missing.map((t) => `"${t}"`).join(', ')}`);
      }
   }

   const uncoveredAi = (ctx.coverage?.items || []).filter((i) =>
     (i.category === 'intent' || i.category === 'knowledge')
     && (i.type === 'paa' || i.type === 'fact' || i.type === 'intent' || i.type === 'definition' || i.type === 'comparison')
     && (!i.covered || i.quality < 4),
   );

   if (uncoveredAi.length) {
      lines.push(
        `AI Search — the article MUST answer ALL ${uncoveredAi.length} checkpoints below (every one is required for a high AI score):\n`
        + uncoveredAi.map((i) => `- ${i.label}`).join('\n'),
      );
   }

   return lines.length ? `\n\nGLOBAL OBJECTIVES (this section must contribute):\n${lines.join('\n\n')}` : '';
}

function sse(res: NextApiResponse, event: string, data: object) {
   res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
   flushSse(res);
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

/** Latest AI-visibility score for an article — same query as pages/api/articles/[id]/index.ts:46-52.
 *  A failed score read must NOT break optimize (worst case: no AI-takeover), so any error -> 0. */
async function readLatestAiScore(articleId: number): Promise<number> {
   try {
      const row = await queryOne<{ score: number | null }>(
         `SELECT score
          FROM ai_visibility_runs
          WHERE article_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT 1`,
         [articleId],
      );
      return row?.score ?? 0;
   } catch {
      return 0;
   }
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
      mode: 'normal',
   }));
   return { steps, estimatedTokens: 0, trimmed: false, ignoredLift: 0, rationale: 'legacy' };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { content, articleId, scoreData, targetScore, maxRounds, writeNewSections } = req.body as {
      content: string;
      articleId?: number;
      scoreData?: ScoreData;
      targetScore?: number;
      maxRounds?: number;
      writeNewSections?: boolean;
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
   flushHeaders(res);
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
      const allowNewSections = writeNewSections === true;
      let workingHtml = content;
      let ctx = articleId != null ? await buildArticleContext(Number(articleId)) : null;

      const aoMeta = (scoreData as (ScoreData & { _ao_meta?: AoMeta }) | undefined)?._ao_meta
         ?? (ctx?.scoreData as (ScoreData & { _ao_meta?: AoMeta }) | null)?._ao_meta;

      // Restore full term list from article_terms + score_data (never shrink to PK splits).
      if (ctx?.scoreData && ctx.keyword) {
         const mergedTerms = termsForOptimize({
            scoreDataTerms: ctx.scoreData.terms,
            tableTerms: ctx.terms,
         });
         const prevCount = ctx.scoreData.terms?.length ?? 0;
         if (mergedTerms.length > prevCount) {
            const nextScoreData = { ...ctx.scoreData, terms: mergedTerms };
            ctx = { ...ctx, scoreData: nextScoreData };
            await persistScoreDataTerms(articleId, nextScoreData, scoreData, res, prevCount);
         } else if (mergedTerms.length !== prevCount) {
            const nextScoreData = { ...ctx.scoreData, terms: mergedTerms };
            ctx = { ...ctx, scoreData: nextScoreData };
            if (scoreData) Object.assign(scoreData, { terms: mergedTerms });
         }
      }

      // Enrich only when still thin after merge.
      if (ctx && ctx.scoreData && ctx.keyword) {
         const competitorDomains = (ctx.competitors || []).map((c) => c.domain).filter(Boolean);
         const baseTerms = termsForOptimize({
            scoreDataTerms: ctx.scoreData.terms,
            tableTerms: ctx.terms,
         });
         if (needsTermEnrichment(baseTerms, ctx.keyword)) {
            let ownDomain: string | undefined;
            try {
               const articleIdSql = await getArticleIdSql();
               const row = await queryOne<{ meta_url: string | null }>(
                  `SELECT meta_url FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
                  [articleId],
               );
               if (row?.meta_url) {
                  ownDomain = new URL(row.meta_url.startsWith('http') ? row.meta_url : `https://${row.meta_url}`).hostname.replace(/^www\./, '');
               }
            } catch { /* optional */ }
            const merged = await enrichNlpTermsIfNeeded({
               terms: baseTerms,
               primaryKeyword: ctx.keyword,
               languageCode: ctx.language,
               competitorDomains,
               ownDomain,
               plainText: workingHtml.replace(/<[^>]+>/g, ' '),
            });
            const useful = filterUsefulNlpTerms(merged);
            if (useful.length > baseTerms.length) {
               const nextScoreData = { ...ctx.scoreData, terms: useful };
               ctx = { ...ctx, scoreData: nextScoreData };
               await persistScoreDataTerms(articleId, nextScoreData, scoreData, res, baseTerms.length);
            }
         }
      }

      const initialSeo = scoreData?.seo_score
         ?? (ctx?.scoreData as (ScoreData & { seo_score?: number }) | null)?.seo_score
         ?? scoreSeo(workingHtml, ctx?.scoreData ?? scoreData, ctx?.keyword || '');
      const initialAi = ctx && articleId != null
         ? scoreAiFromContext(ctx, workingHtml, await readLatestAiScore(Number(articleId)))
         : 0;
      const initialContent = computeOverallContentScore(initialSeo, initialAi);
      const phase = resolveOptimizePhase({
         contentScore: initialContent,
         aoMeta,
         hasPriorAutoOptimizeVersion: (aoMeta?.runs ?? 0) >= 1,
      });
      const TARGET_SEO_SCORE = phase === 'first_run'
         ? Math.min(100, Math.max(TARGET_SEO, Number(targetScore) || TARGET_SEO))
         : Math.min(100, Math.max(85, Number(targetScore) || 90));
      const TARGET_AI_SCORE = TARGET_AI;
      const TARGET_CONTENT_SCORE = targetContentForPhase(phase);
      const MAX_ROUNDS = Math.min(6, Math.max(1, Number(maxRounds) || maxRoundsForPhase(phase) || DEFAULT_MAX_ROUNDS));

      let changedCount = 0;
      let aiTokens = 0;
      let roundsRun = 0;
      let finalSeo = 0;
      let finalAi = 0;
      let finalContent = 0;
      let trimmedMeta: { trimmed: boolean; ignoredLift: number } = { trimmed: false, ignoredLift: 0 };

      sse(res, 'meta', {
         total: splitSections(workingHtml).length,
         targetSeo: TARGET_SEO_SCORE,
         targetAi: TARGET_AI_SCORE,
         targetContent: TARGET_CONTENT_SCORE,
         maxRounds: MAX_ROUNDS,
         phase,
      });

      try {
         for (let round = 1; round <= MAX_ROUNDS && !aborted; round += 1) {
            roundsRun = round;
            const sections = splitSections(workingHtml);
            const snapshot = ctx?.coverage ?? null;
            const guidelines = snapshot ? buildGuidelines(snapshot, ctx ?? undefined) : [];
            const usage = orgId != null ? await getOrgUsage5h(orgId) : { used: 0, limit: AI_TOKEN_LIMIT_5H, resetsAt: 0, over: false };
            const seoScore = scoreData?.seo_score
               ?? (ctx?.scoreData as (ScoreData & { seo_score?: number }) | null)?.seo_score
               ?? scoreSeo(workingHtml, ctx?.scoreData ?? scoreData, ctx?.keyword || '');
            const aiScore = ctx && articleId != null
               ? scoreAiFromContext(ctx, workingHtml, await readLatestAiScore(Number(articleId)))
               : 0;
            const mode = selectOptimizeMode(seoScore, aiScore, phase);

            let plan: Plan = ctx
               ? buildOptimizationPlan({
                  sections, guidelines, context: ctx, budgetRemaining: usage.limit - usage.used,
                  seoScore, aiScore, phase, mode,
               })
               : legacyPlan(sections, scoreData, workingHtml);

            if (!allowNewSections) {
               plan = {
                  ...plan,
                  steps: plan.steps.map((step) => (
                     step.focus === 'expand'
                        ? { ...step, focus: 'ai-coverage' as const, mode: 'less' as const }
                        : { ...step, mode: step.mode === 'expand' ? 'less' as const : step.mode }
                  )),
               };
            }

            if (plan.trimmed && round === 1) {
               trimmedMeta = { trimmed: true, ignoredLift: plan.ignoredLift };
               sse(res, 'meta', { trimmed: true, ignoredLift: plan.ignoredLift });
            }

            let roundChanged = 0;
            const brief = ctx ? globalOptimizeBrief(ctx, workingHtml, mode) : '';

            for (const step of plan.steps) {
               if (aborted) break;

               const liveSection = sections[step.index];
               const section: Section = liveSection ?? {
                  id: step.sectionId,
                  index: step.index,
                  headingText: step.headingText,
                  html: step.html,
               };

               if (step.focus === 'skip') {
                  sse(res, 'section', buildSectionEvent(section, undefined, step));
                  continue;
               }

               let newHtml = section.html;
               const systemPrompt = `${step.systemPrompt}${brief}`;
               const MAX_ATTEMPTS = 3;
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
                              { role: 'user', content: step.userInstruction ?? `Improve this section:\n\n${section.html}` },
                           ],
                        }),
                        signal: controller.signal,
                     });
                     if (!aiRes.ok) throw new Error(`HTTP ${aiRes.status}`);
                     const data = await aiRes.json();
                     aiTokens += data.usage?.total_tokens || 0;
                     const cleaned = stripFences(data.choices?.[0]?.message?.content || '');
                     if (isUsableEdit(cleaned)) newHtml = cleaned;
                     break;
                  } catch (error) {
                     if (aborted || (error instanceof Error && error.name === 'AbortError')) break;
                     if (attempt === MAX_ATTEMPTS) newHtml = section.html;
                  }
               }

               if (aborted) break;

               const changed = normalizeHtmlForDiff(section.html) !== normalizeHtmlForDiff(newHtml);
               if (changed) {
                  roundChanged += 1;
                  changedCount += 1;
                  if (liveSection) {
                     sections[step.index] = { ...liveSection, html: newHtml };
                  }
               }
               sse(res, 'section', buildSectionEvent(
                  section,
                  { oldHtml: section.html, newHtml, changed },
                  step,
               ));
            }

            workingHtml = joinSections(sections);
            finalSeo = scoreSeo(workingHtml, ctx?.scoreData ?? scoreData, ctx?.keyword || '');
            finalAi = ctx && articleId != null
               ? scoreAiFromContext(ctx, workingHtml, await readLatestAiScore(Number(articleId)))
               : 0;
            finalContent = computeOverallContentScore(finalSeo, finalAi);
            sse(res, 'progress', {
               round,
               seo: finalSeo,
               ai: finalAi,
               content: finalContent,
               mode,
               phase,
               targetSeo: TARGET_SEO_SCORE,
               targetAi: TARGET_AI_SCORE,
               targetContent: TARGET_CONTENT_SCORE,
               changed: roundChanged,
            });

            const hitContentTarget = finalContent >= TARGET_CONTENT_SCORE;
            const hitSeoAi = finalSeo >= TARGET_SEO_SCORE && finalAi >= TARGET_AI_SCORE;
            if ((hitContentTarget || hitSeoAi) || roundChanged === 0) break;
         }

      } finally {
         if (!aborted && orgId != null && shouldChargeCredit(changedCount, aiTokens)) {
            await recordAiTokens(orgId, aiTokens);
         }
      }

      if (aborted) return;

      const creditDeducted = orgId != null && shouldChargeCredit(changedCount, aiTokens);

      sse(res, 'done', {
         changedCount, total: splitSections(content).length, promptVersion: PROMPT_VERSION,
         creditDeducted, rounds: roundsRun, phase,
         seo: finalSeo, ai: finalAi, content: finalContent,
         targetSeo: TARGET_SEO_SCORE, targetAi: TARGET_AI_SCORE, targetContent: TARGET_CONTENT_SCORE,
         trimmed: trimmedMeta.trimmed, ignoredLift: trimmedMeta.ignoredLift,
      });
   } catch (error) {
      if (!aborted) sse(res, 'error', { message: getErrorMessage(error) || 'Request failed' });
   } finally {
      req.off('close', onClose);
      res.end();
   }
}
