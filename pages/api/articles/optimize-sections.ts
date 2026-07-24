import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess, ensureUserTenancy } from '../../../lib/tenancy';
import { getOrgUsage5h, recordAiTokens, AI_TOKEN_LIMIT_5H } from '../../../lib/aiTokenUsage';
import { splitSections, normalizeHtmlForDiff } from '../../../lib/articleSections';
import type { Section } from '../../../lib/articleSections';
import { buildSectionEvent } from '../../../lib/optimizeSectionEvents';
import { buildWholeArticlePrompt, WHOLE_ARTICLE_ID } from '../../../lib/optimizeWholeArticle';
import {
   stripFences,
   isUsableEdit,
   isUsableWholeArticleEdit,
   shouldChargeCredit,
   resolveOptimizeDoneOutcome,
} from '../../../lib/optimizeSectionEdit';
import type { ScoreData } from '../../../lib/contentScore';
import { computeOverallContentScore } from '../../../lib/aiSearchScore';
import { buildArticleContext } from '../../../lib/articleContext';
import type { ArticleContext } from '../../../lib/articleContext';
import { enrichNlpTermsIfNeeded, needsTermEnrichment } from '../../../lib/articleKeywordDiscovery';
import { filterUsefulNlpTerms } from '../../../lib/competitorTermCalibration';
import { termsForOptimize } from '../../../lib/mergeArticleTerms';
import { liveCoverageItems } from '../../../lib/liveCoverage';
import { collectUncoveredAiQuestions, buildFaqSectionPrompt, mergeFaqHtml } from '../../../lib/aoFaqSection';
import { structureIssues } from '../../../lib/validateArticleStructure';
import { scoreArticleHtml } from '../../../lib/scoreArticleHtml';
import { getArticleIdSql } from '../../../lib/articleSql';
import db from '../../../database/database';
import { buildGuidelines } from '../../../lib/recommendationEngine';
import {
  DEFAULT_MAX_ROUNDS,
  selectOptimizeMode,
  TARGET_AI,
  TARGET_SEO,
} from '../../../lib/optimizeMode';
import {
  maxRoundsForPhase,
  resolveOptimizePhase,
  targetContentForPhase,
  type AoMeta,
} from '../../../lib/optimizeRunPhase';
import { getErrorMessage } from '../../../lib/errors';
import { throwIfAborted } from '../../../lib/abortSignal';
import { queryOne } from '../../../lib/db/query';
import { flushSse, flushHeaders } from '../../../lib/types/api';

export const config = { maxDuration: 300, api: { responseLimit: '10mb' } };

const PROMPT_VERSION = 'ao-whole-article-v3-human';

type ChatCompletion = {
   content: string;
   finishReason: unknown;
   totalTokens: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
   return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
}

function parseChatCompletion(raw: unknown): ChatCompletion {
   const data = asRecord(raw);
   const usage = asRecord(data?.usage);
   const choices = data?.choices;
   const firstChoice = Array.isArray(choices) ? asRecord(choices[0]) : null;
   const message = asRecord(firstChoice?.message);
   const tokenCount = Number(usage?.total_tokens);

   return {
      content: typeof message?.content === 'string' ? message.content : '',
      finishReason: firstChoice?.finish_reason ?? firstChoice?.finishReason,
      totalTokens: Number.isFinite(tokenCount) ? tokenCount : 0,
   };
}

function scoreSeo(
   html: string,
   scoreData: ScoreData | undefined,
   keyword: string,
   ctx?: ArticleContext | null,
): number {
   if (!scoreData) return 0;
   return scoreArticleHtml({
      html,
      scoreData,
      keyword,
      coverageItems: ctx?.coverage?.items,
      answersMainQuestionEarly: !!ctx?.coverage?.answersMainQuestionEarly,
   }).seo;
}

function scoreAiFromContext(ctx: ArticleContext | null, html: string, latestAiScore: number): number {
   if (ctx?.coverage?.items?.length && ctx.scoreData) {
      return scoreArticleHtml({
         html,
         scoreData: ctx.scoreData,
         keyword: ctx.keyword || '',
         coverageItems: ctx.coverage.items,
         answersMainQuestionEarly: !!ctx.coverage.answersMainQuestionEarly,
      }).ai;
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

function sse(res: NextApiResponse, event: string, data: object) {
   res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
   flushSse(res);
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { content, articleId, scoreData, targetScore, maxRounds } = req.body as {
      content: string;
      articleId?: number;
      scoreData?: ScoreData;
      targetScore?: number;
      maxRounds?: number;
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
   req.on('aborted', onClose);

   try {
      throwIfAborted(controller.signal);
      let workingHtml = content;
      let ctx = articleId != null ? await buildArticleContext(Number(articleId)) : null;

      throwIfAborted(controller.signal);

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
            if (aborted) throw new DOMException('Aborted', 'AbortError');
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
               signal: controller.signal,
            });
            const useful = filterUsefulNlpTerms(merged);
            if (useful.length > baseTerms.length) {
               const nextScoreData = { ...ctx.scoreData, terms: useful };
               ctx = { ...ctx, scoreData: nextScoreData };
               await persistScoreDataTerms(articleId, nextScoreData, scoreData, res, baseTerms.length);
            }
         }
      }

      const initialSeo = scoreSeo(workingHtml, ctx?.scoreData ?? scoreData, ctx?.keyword || '', ctx);
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
      let rejectedUnusable = 0;
      let aiTokens = 0;
      let roundsRun = 0;
      let finalSeo = 0;
      let finalAi = 0;
      let finalContent = 0;
      let trimmedMeta: { trimmed: boolean; ignoredLift: number } = { trimmed: false, ignoredLift: 0 };

      sse(res, 'meta', {
         total: MAX_ROUNDS,
         targetSeo: TARGET_SEO_SCORE,
         targetAi: TARGET_AI_SCORE,
         targetContent: TARGET_CONTENT_SCORE,
         maxRounds: MAX_ROUNDS,
         phase,
         wholeArticle: true,
      });

      const originalHtml = content;

      try {
         for (let round = 1; round <= MAX_ROUNDS && !aborted; round += 1) {
            roundsRun = round;
            const snapshot = ctx?.coverage ?? null;
            const guidelines = snapshot ? buildGuidelines(snapshot, ctx ?? undefined) : [];
            const seoScore = scoreSeo(workingHtml, ctx?.scoreData ?? scoreData, ctx?.keyword || '', ctx);
            const aiScore = ctx && articleId != null
               ? scoreAiFromContext(ctx, workingHtml, await readLatestAiScore(Number(articleId)))
               : 0;
            const mode = selectOptimizeMode(seoScore, aiScore, phase);

            const promptPack = buildWholeArticlePrompt({
               ctx,
               html: workingHtml,
               guidelines,
               seoScore,
               aiScore,
               phase,
               mode,
            });

            let newHtml = workingHtml;
            const MAX_ATTEMPTS = 3;
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
               try {
                  const surgicalHint = attempt > 1
                     ? '\n\nIMPORTANT: Previous reply was truncated or incomplete. Make SMALLER surgical edits only '
                       + '(a few paragraphs or one section). Return the COMPLETE article HTML — do not omit later sections.'
                     : '';
                  const aiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                     body: JSON.stringify({
                        model: 'deepseek-chat',
                        max_tokens: 8000,
                        temperature: 0.3,
                        messages: [
                           { role: 'system', content: promptPack.systemPrompt },
                           { role: 'user', content: `${promptPack.userInstruction}${surgicalHint}\n\n${workingHtml}` },
                        ],
                     }),
                     signal: controller.signal,
                  });
                  if (!aiRes.ok) throw new Error(`HTTP ${aiRes.status}`);
                  const data = parseChatCompletion(await aiRes.json());
                  aiTokens += data.totalTokens;
                  const cleaned = stripFences(data.content);
                  if (!isUsableWholeArticleEdit(cleaned, workingHtml, data.finishReason)) {
                     rejectedUnusable += 1;
                     // Truncate / too-short: retry with surgical hint instead of accepting "no change".
                     if (attempt < MAX_ATTEMPTS) continue;
                     break;
                  }
                  newHtml = cleaned;

                  const issues = structureIssues(newHtml);
                  if (issues.length > 0 && attempt === 1) {
                     const retryPack = buildWholeArticlePrompt({
                        ctx,
                        html: newHtml,
                        guidelines,
                        seoScore,
                        aiScore,
                        phase,
                        mode,
                     });
                     const structurePrompt = `${retryPack.systemPrompt}\n\nSTRUCTURE FIX REQUIRED:\n${issues.join('\n')}`;
                     try {
                        const retryRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
                           method: 'POST',
                           headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                           body: JSON.stringify({
                              model: 'deepseek-chat',
                              max_tokens: 8000,
                              temperature: 0.3,
                              messages: [
                                 { role: 'system', content: structurePrompt },
                                 { role: 'user', content: `Fix structure issues and return complete HTML.\n\n${newHtml}` },
                              ],
                           }),
                           signal: controller.signal,
                        });
                        if (retryRes.ok) {
                           const retryData = parseChatCompletion(await retryRes.json());
                           aiTokens += retryData.totalTokens;
                           const retryCleaned = stripFences(retryData.content);
                           if (isUsableWholeArticleEdit(retryCleaned, workingHtml, retryData.finishReason)) {
                              newHtml = retryCleaned;
                           } else {
                              rejectedUnusable += 1;
                           }
                        }
                     } catch { /* non-fatal */ }
                  }
                  break;
               } catch (error) {
                  if (aborted || (error instanceof Error && error.name === 'AbortError')) break;
                  if (attempt === MAX_ATTEMPTS) newHtml = workingHtml;
               }
            }

            if (aborted) break;

            const roundChanged = normalizeHtmlForDiff(workingHtml) !== normalizeHtmlForDiff(newHtml);
            if (roundChanged) {
               workingHtml = newHtml;
               changedCount += 1;
            }

            finalSeo = scoreSeo(workingHtml, ctx?.scoreData ?? scoreData, ctx?.keyword || '', ctx);
            finalAi = ctx && articleId != null
               ? scoreAiFromContext(ctx, workingHtml, await readLatestAiScore(Number(articleId)))
               : 0;
            finalContent = computeOverallContentScore(finalSeo, finalAi);
            sse(res, 'progress', {
               round,
               processed: round,
               seo: finalSeo,
               ai: finalAi,
               content: finalContent,
               mode,
               phase,
               targetSeo: TARGET_SEO_SCORE,
               targetAi: TARGET_AI_SCORE,
               targetContent: TARGET_CONTENT_SCORE,
               changed: roundChanged ? 1 : 0,
            });

            const hitContentTarget = finalContent >= TARGET_CONTENT_SCORE;
            const hitSeoAi = finalSeo >= TARGET_SEO_SCORE && finalAi >= TARGET_AI_SCORE;
            const plainForCov = workingHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const liveItems = ctx?.coverage?.items?.length
               ? liveCoverageItems(ctx.coverage.items, plainForCov, workingHtml)
               : [];
            const stillUncovered = collectUncoveredAiQuestions(liveItems).length;
            if ((hitContentTarget || hitSeoAi) && stillUncovered === 0) break;
            if ((hitContentTarget || hitSeoAi) && !roundChanged) break;
            // One no-op is not "done" while still far from targets — the next round rebuilds
            // the prompt (mode/focus can shift after a partial FAQ-less pass). Stop after 2.
            if (!roundChanged && round >= 2) break;
            if (!roundChanged && finalContent >= TARGET_CONTENT_SCORE - 5) break;
         }

         // FAQ round — answer remaining AI Search questions (coverage items, else PAA fallback).
         // Without this fallback, articles with AI≈19 and no coverage snapshot never get a FAQ
         // and whole-article "less" edits used to echo → "didn't change this time".
         if (!aborted && ctx && ((ctx.coverage?.items?.length ?? 0) > 0 || (ctx.paa?.length ?? 0) > 0)) {
            const plainForFaq = workingHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const liveForFaq = ctx.coverage?.items?.length
               ? liveCoverageItems(ctx.coverage.items, plainForFaq, workingHtml)
               : [];
            let uncovered = collectUncoveredAiQuestions(liveForFaq);
            if (uncovered.length === 0 && ctx.paa?.length) {
               uncovered = ctx.paa.slice(0, 12).map((label, i) => ({ id: `paa-${i}`, label }));
            }
            if (uncovered.length > 0) {
               const faqPrompt = buildFaqSectionPrompt({
                  keyword: ctx.keyword || '',
                  questions: uncovered.map((q) => q.label),
                  articleExcerpt: plainForFaq,
                  language: ctx.language || 'pl',
               });
               try {
                  const faqRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                     body: JSON.stringify({
                        model: 'deepseek-chat',
                        max_tokens: 4000,
                        temperature: 0.3,
                        messages: [
                           { role: 'system', content: faqPrompt.systemPrompt },
                           { role: 'user', content: faqPrompt.userInstruction },
                        ],
                     }),
                     signal: controller.signal,
                  });
                  if (faqRes.ok) {
                     const faqData = await faqRes.json();
                     aiTokens += faqData.usage?.total_tokens || 0;
                     const faqHtml = stripFences(faqData.choices?.[0]?.message?.content || '');
                     if (isUsableEdit(faqHtml)) {
                        workingHtml = mergeFaqHtml(workingHtml, faqHtml);
                        changedCount += 1;
                        finalSeo = scoreSeo(workingHtml, ctx?.scoreData ?? scoreData, ctx?.keyword || '', ctx);
                        finalAi = articleId != null
                           ? scoreAiFromContext(ctx, workingHtml, await readLatestAiScore(Number(articleId)))
                           : 0;
                        finalContent = computeOverallContentScore(finalSeo, finalAi);
                        sse(res, 'progress', {
                           round: roundsRun + 1,
                           processed: roundsRun + 1,
                           seo: finalSeo,
                           ai: finalAi,
                           content: finalContent,
                           phase: 'faq',
                           changed: 1,
                        });
                     }
                  }
               } catch { /* non-fatal */ }
            }
         }

         if (!aborted && normalizeHtmlForDiff(originalHtml) !== normalizeHtmlForDiff(workingHtml)) {
            const pseudoSection = splitSections(workingHtml)[0] ?? {
               id: WHOLE_ARTICLE_ID,
               index: 0,
               headingText: 'Article',
               html: workingHtml,
            };
            sse(res, 'section', buildSectionEvent(
               { ...pseudoSection, id: WHOLE_ARTICLE_ID, headingText: 'Article' },
               { oldHtml: originalHtml, newHtml: workingHtml, changed: true },
               {
                  sectionId: WHOLE_ARTICLE_ID,
                  index: 0,
                  headingText: 'Article',
                  html: workingHtml,
                  focus: 'ai-coverage',
                  systemPrompt: '',
                  guidelines: [],
                  missingTerms: [],
                  estimatedTokens: 0,
                  expectedLift: 0,
                  reason: 'Whole-article optimization',
                  mode: 'less',
               },
            ));
         }

      } finally {
         if (!aborted && orgId != null && shouldChargeCredit(changedCount, aiTokens)) {
            await recordAiTokens(orgId, aiTokens);
         }
      }

      if (aborted) return;

      const creditDeducted = orgId != null && shouldChargeCredit(changedCount, aiTokens);
      const outcome = resolveOptimizeDoneOutcome({
         changedCount,
         rejectedUnusable,
         initialSeo,
         initialAi,
         initialContent,
         targetSeo: TARGET_SEO_SCORE,
         targetAi: TARGET_AI_SCORE,
         targetContent: TARGET_CONTENT_SCORE,
      });

      sse(res, 'done', {
         changedCount, total: MAX_ROUNDS, promptVersion: PROMPT_VERSION,
         creditDeducted, rounds: roundsRun, phase, outcome,
         seo: finalSeo, ai: finalAi, content: finalContent,
         targetSeo: TARGET_SEO_SCORE, targetAi: TARGET_AI_SCORE, targetContent: TARGET_CONTENT_SCORE,
         trimmed: trimmedMeta.trimmed, ignoredLift: trimmedMeta.ignoredLift,
         wholeArticle: true,
      });
   } catch (error) {
      if (aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
      if (!aborted) sse(res, 'error', { message: getErrorMessage(error) || 'Request failed' });
   } finally {
      req.off('close', onClose);
      req.off('aborted', onClose);
      res.end();
   }
}
