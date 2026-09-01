/**
 * WIE Evaluation Suite — pipeline + judge + benchmark + reports + history.
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { queryOne, queryRows } from '../../db/query';
import { getArticleIdSql } from '../../articleSql';
import { buildArticleContext } from '../../articleContext';
import { runPrecisionOptimizeV4 } from '../../ao/runPrecisionOptimize';
import { wieLlmComplete, wieWriterSystemPrompt } from '../writer';
import { scoreEeat } from '../eeatScore';
import { buildWieWriteContext } from '../writerContext';
import { formatCompetitorSynthesisForPrompt } from '../competitorSynthesis';
import { formatPolicyBundleForPrompt } from '../policyResolver';
import { formatReaderBriefForPrompt } from '../readerBrief';
import {
  computeWritingIntelligence,
  coverageScoreFromSnapshot,
  patternUsageScore,
  scale10to100,
} from './scorecard';
import { buildCompetitorBenchmark, type CompetitorDoc } from './competitorBenchmark';
import { runEditorialJudge } from './editorialJudge';
import {
  buildTechnicalMarkdown,
  buildEditorialMarkdown,
  buildVerdictJson,
} from './reports';
import { appendHistory, writeTrendsFile, evalRootDir } from './history';
import { cronBearerHeader } from '../../cronAuth';
import { nextjsUrl } from '../../serviceUrls';
import { scoreArticleHtml } from '../../scoreArticleHtml';
import type { ScoreData } from '../../contentScore';
import { evaluatePublishGate, scoreRootIntentCoverage } from './publishGate';
import { reconcileBeatsTop5 } from './verdictAlign';
import { evaluatePolicyCompliance } from './policyCompliance';

export type WieEvalOptions = {
  keyword?: string;
  domainId?: number;
  articleId?: number;
  language?: string;
  skipDa?: boolean;
  skipGenerate?: boolean;
  skipAo?: boolean;
  skipJudge?: boolean;
  benchmark?: boolean;
  baseUrl?: string;
};

export type WieEvalResult = {
  runId: string;
  articleId: number;
  keyword: string;
  outDir: string;
  writingIntelligence: number;
  pipelineOk: boolean;
  beats_top5: string;
  paths: Record<string, string>;
};

type TimedLog = { t: number; msg: string };

type PipelineScores = { seo: number; ai: number; content: number };

function parseScoreData(raw: string | null | undefined): ScoreData | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as ScoreData;
  } catch {
    return null;
  }
}

/** Live SEO/AI from same formula as editor gauges — never leave SEO=0 when HTML+score_data exist. */
function livePipelineScores(opts: {
  html: string;
  keyword: string;
  scoreDataRaw: string | null | undefined;
  contentScore: number | null | undefined;
}): PipelineScores {
  const content = opts.contentScore ?? 0;
  const sd = parseScoreData(opts.scoreDataRaw);
  if (sd && opts.html.trim()) {
    try {
      const scored = scoreArticleHtml({
        html: opts.html,
        scoreData: sd,
        keyword: opts.keyword,
      });
      return {
        seo: Math.round(scored.seo),
        ai: Math.round(scored.ai),
        content: Math.round(scored.overall || content || scored.seo),
      };
    } catch {
      /* fall through */
    }
  }
  return { seo: content, ai: 0, content };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function parseSseArticleId(res: Response): Promise<{ articleId: number; errors: string[] }> {
  const text = await res.text();
  const errors: string[] = [];
  let articleId = 0;
  for (const block of text.split('\n\n')) {
    const ev = /event:\s*(\w+)/.exec(block)?.[1];
    const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
    if (!dataLine) continue;
    try {
      const data = JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>;
      if ((ev === 'created' || ev === 'done') && typeof data.articleId === 'number') {
        articleId = data.articleId;
      }
      if (ev === 'error') {
        errors.push(String(data.message || data.step || 'sse_error'));
      }
      if (ev === 'done' && typeof data.articleId === 'number') articleId = data.articleId;
    } catch {
      /* ignore */
    }
  }
  // Also scan any articleId in done payloads without event name
  if (!articleId) {
    const m = /"articleId"\s*:\s*(\d+)/.exec(text);
    if (m) articleId = parseInt(m[1], 10);
  }
  return { articleId, errors };
}

async function pollGenerateDone(opts: {
  baseUrl: string;
  articleId: number;
  headers: Record<string, string>;
  timeoutMs: number;
  log: (m: string) => void;
}): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < opts.timeoutMs) {
    const r = await fetch(
      `${opts.baseUrl}/api/articles/job-progress?articleId=${opts.articleId}&jobType=article_generate`,
      { headers: opts.headers },
    );
    if (r.ok) {
      const j = await r.json() as { status?: string };
      opts.log(`generate poll status=${j.status || '?'}`);
      if (j.status === 'done' || j.status === 'completed') return true;
      if (j.status === 'error' || j.status === 'failed') return false;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

export async function runWieEvalSuite(opts: WieEvalOptions): Promise<WieEvalResult> {
  const runId = `wie_${Date.now().toString(36)}`;
  const outDir = path.join(evalRootDir(), runId);
  await mkdir(outDir, { recursive: true });

  const logs: TimedLog[] = [];
  const t0 = Date.now();
  const log = (msg: string) => {
    logs.push({ t: Date.now() - t0, msg });
    console.log(`[wie-eval ${runId}]`, msg);
  };
  const timings: Record<string, number> = {};
  const errors: string[] = [];
  let tokens = 0;
  let pipelineOk = true;

  const baseUrl = (opts.baseUrl || nextjsUrl() || 'http://localhost:3000').replace(/\/$/, '');
  const bearer = cronBearerHeader();
  if (!bearer) throw new Error('CRON_SECRET not configured');
  const headers: Record<string, string> = {
    Authorization: bearer,
    'Content-Type': 'application/json',
    'x-cron-secret': bearer.replace(/^Bearer\s+/i, ''),
  };

  let articleId = opts.articleId ?? 0;
  let keyword = (opts.keyword || '').trim();
  let domainId = opts.domainId;

  // ── Deep Analysis ──────────────────────────────────────────────
  if (!opts.skipDa && keyword && domainId) {
    const s = Date.now();
    log(`DA start keyword=${keyword} domainId=${domainId}`);
    const daRes = await fetch(`${baseUrl}/api/articles/deep-analysis`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        keywords: [keyword],
        domainId,
        language: opts.language,
      }),
    });
    const parsed = await parseSseArticleId(daRes);
    if (parsed.articleId) articleId = parsed.articleId;
    errors.push(...parsed.errors);
    if (!articleId) {
      pipelineOk = false;
      errors.push('da_no_article_id');
    }
    timings.deep_analysis = Date.now() - s;
    log(`DA done articleId=${articleId} errors=${parsed.errors.length}`);
  } else if (articleId) {
    log(`skip DA — using articleId=${articleId}`);
  } else {
    throw new Error('Need --keyword+--domainId or --articleId');
  }

  const idSql = await getArticleIdSql();
  const row = await queryOne<{
    id: number;
    domain_id: number | null;
    target_keyword: string | null;
    content: string | null;
    content_score: number | null;
    score_data: string | null;
    ai_info_to_cover: string | null;
  }>(
    `SELECT ${idSql} AS id, domain_id, target_keyword, content, content_score, score_data, ai_info_to_cover
     FROM articles WHERE ${idSql} = ? LIMIT 1`,
    [articleId],
  );
  if (!row) throw new Error(`article_${articleId}_not_found`);
  if (!keyword) keyword = row.target_keyword || '';
  if (domainId == null) domainId = row.domain_id ?? undefined;

  // ── Generate ───────────────────────────────────────────────────
  if (!opts.skipGenerate) {
    const s = Date.now();
    log('Generate kickoff');
    const gRes = await fetch(`${baseUrl}/api/articles/${articleId}/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ language: opts.language || 'pl' }),
    });
    if (!gRes.ok) {
      pipelineOk = false;
      errors.push(`generate_http_${gRes.status}`);
      log(`Generate kickoff failed ${gRes.status}`);
    } else {
      const ok = await pollGenerateDone({
        baseUrl,
        articleId,
        headers,
        timeoutMs: 180_000,
        log,
      });
      if (!ok) {
        // Content may still arrive — re-read DB
        log('Generate poll timeout/fail — checking DB content');
      }
    }
    timings.generate = Date.now() - s;
  }

  const afterGen = await queryOne<{ content: string | null; content_score: number | null; score_data: string | null; ai_info_to_cover: string | null }>(
    `SELECT content, content_score, score_data, ai_info_to_cover FROM articles WHERE ${idSql} = ? LIMIT 1`,
    [articleId],
  );
  let htmlBefore = afterGen?.content || row.content || '';
  await writeFile(path.join(outDir, 'article.before.html'), htmlBefore || '<!-- empty -->', 'utf-8');

  // ── AO ─────────────────────────────────────────────────────────
  let htmlAfter = htmlBefore;
  const liveBefore = livePipelineScores({
    html: htmlBefore,
    keyword,
    scoreDataRaw: afterGen?.score_data || row.score_data,
    contentScore: afterGen?.content_score ?? row.content_score,
  });
  let scoresBefore: PipelineScores = liveBefore;
  let scoresAfter: PipelineScores = { ...liveBefore };
  let patternIds: string[] = [];
  let rxVetoes = 0;
  let explainability: Awaited<ReturnType<typeof buildWieWriteContext>>['explainability'] = [];
  let dnaVersion: number | undefined;

  if (!opts.skipAo && htmlBefore.trim()) {
    const s = Date.now();
    log('AO precision start');
    try {
      const ctx = await buildArticleContext(articleId);
      const v4 = await runPrecisionOptimizeV4({
        runId: `${runId}-ao`,
        html: htmlBefore,
        ctx,
        scoreData: ctx.scoreData ?? undefined,
        keyword,
        llmEdit: async (prompt) => {
          const r = await wieLlmComplete({
            userPrompt: prompt,
            systemPrompt: wieWriterSystemPrompt(),
            maxTokens: 4000,
            temperature: 0.2,
          });
          tokens += r.tokens;
          return r;
        },
      });
      htmlAfter = v4.html;
      scoresBefore = {
        seo: v4.baseline.scores.seo || liveBefore.seo,
        ai: v4.baseline.scores.ai || liveBefore.ai,
        content: v4.baseline.scores.content || liveBefore.content,
      };
      scoresAfter = {
        seo: v4.finalScores.seo || liveBefore.seo,
        ai: v4.finalScores.ai || liveBefore.ai,
        content: v4.finalScores.content || liveBefore.content,
      };
      // If AO returned zeros, re-score live HTML
      if (scoresAfter.seo === 0 && htmlAfter.trim()) {
        scoresAfter = livePipelineScores({
          html: htmlAfter,
          keyword,
          scoreDataRaw: afterGen?.score_data || row.score_data,
          contentScore: afterGen?.content_score ?? row.content_score,
        });
      }
      rxVetoes = v4.trace.events.filter((e) => e.step === 'rx_quality_gate' || (e.metadata as { rejected?: boolean } | undefined)?.rejected).length;
      const meta = v4.trace.events.find((e) => e.step === 'intent_analysis')?.metadata as {
        patternIdsUsed?: string[];
        explainability?: typeof explainability;
        dna_version?: number;
      } | undefined;
      patternIds = meta?.patternIdsUsed || [];
      if (Array.isArray(meta?.explainability)) explainability = meta.explainability;
      dnaVersion = meta?.dna_version;

      // Persist AO result
      const wordCount = stripTags(htmlAfter).split(/\s+/).filter(Boolean).length;
      await queryRows(
        `UPDATE articles SET content = ?, content_score = ?, word_count = ?, updated_at = CURRENT_TIMESTAMP
         WHERE ${idSql} = ?`,
        [htmlAfter, scoresAfter.content, wordCount, articleId],
      );
      log(`AO done seo=${scoresAfter.seo} ai=${scoresAfter.ai} changed=${v4.changed}`);
    } catch (e) {
      pipelineOk = false;
      errors.push(e instanceof Error ? e.message : 'ao_failed');
      log(`AO failed: ${errors[errors.length - 1]}`);
    }
    timings.ao = Date.now() - s;
  } else {
    htmlAfter = htmlBefore;
    scoresAfter = livePipelineScores({
      html: htmlAfter,
      keyword,
      scoreDataRaw: afterGen?.score_data || row.score_data,
      contentScore: afterGen?.content_score ?? row.content_score,
    });
    scoresBefore = { ...scoresAfter };
    log(`skip AO — live scores seo=${scoresAfter.seo} ai=${scoresAfter.ai}`);
  }

  await writeFile(path.join(outDir, 'article.after.html'), htmlAfter || '<!-- empty -->', 'utf-8');

  // Competitors / terms / coverage
  const competitors = await queryRows<{ domain: string | null; url: string | null; title: string | null; headings_json: string | null }>(
    `SELECT domain, url, title, headings_json FROM article_competitors WHERE article_id = ? LIMIT 10`,
    [articleId],
  );
  const terms = await queryRows<{ term: string }>(
    `SELECT term FROM article_terms WHERE article_id = ? LIMIT 200`,
    [articleId],
  ).catch(() => [] as Array<{ term: string }>);

  let coverageTotal = 0;
  let coverageCovered = 0;
  try {
    const cov = afterGen?.ai_info_to_cover || row.ai_info_to_cover;
    if (cov) {
      const snap = JSON.parse(cov) as { items?: Array<{ covered?: boolean }> };
      const items = snap.items || [];
      coverageTotal = items.length;
      coverageCovered = items.filter((i) => i.covered).length;
    }
  } catch { /* ignore */ }

  await writeFile(path.join(outDir, 'competitors.json'), JSON.stringify(competitors, null, 2), 'utf-8');
  await writeFile(path.join(outDir, 'terms.json'), JSON.stringify(terms.slice(0, 100), null, 2), 'utf-8');
  await writeFile(
    path.join(outDir, 'coverage.json'),
    JSON.stringify({ total: coverageTotal, covered: coverageCovered }, null, 2),
    'utf-8',
  );
  await writeFile(
    path.join(outDir, 'scores.json'),
    JSON.stringify({ before: scoresBefore, after: scoresAfter }, null, 2),
    'utf-8',
  );

  // WIE context for explainability if missing
  let wieCtx = null as Awaited<ReturnType<typeof buildWieWriteContext>> | null;
  try {
    wieCtx = await buildWieWriteContext({
      keyword,
      scoreData: afterGen?.score_data
        ? JSON.parse(afterGen.score_data) as { competitor_synthesis?: unknown }
        : null,
    });
    if (!explainability.length) explainability = wieCtx.explainability;
    if (dnaVersion == null) dnaVersion = wieCtx.policy?.dna_version;
  } catch { /* ignore */ }

  await writeFile(
    path.join(outDir, 'wie.json'),
    JSON.stringify({
      dna_version: dnaVersion,
      explainability,
      patternIds,
      policy: wieCtx?.policy ?? null,
      narrative: wieCtx?.narrative ?? null,
    }, null, 2),
    'utf-8',
  );

  // ── Benchmark ──────────────────────────────────────────────────
  const doBench = opts.benchmark !== false;
  const competitorDocs: CompetitorDoc[] = competitors.slice(0, 5).map((c, i) => {
    let plain = [c.title, c.domain].filter(Boolean).join(' — ');
    try {
      const heads = c.headings_json ? JSON.parse(c.headings_json) as unknown : null;
      if (Array.isArray(heads)) {
        plain += ' ' + heads.filter((h): h is string => typeof h === 'string').slice(0, 12).join(' ');
      }
    } catch { /* ignore */ }
    return { label: `Top${i + 1}`, title: c.title || undefined, plain };
  });

  let benchmark = doBench
    ? buildCompetitorBenchmark({ aoHtml: htmlAfter, competitors: competitorDocs })
    : null;

  // ── Editorial Judge ────────────────────────────────────────────
  const judge = await runEditorialJudge({
    skip: opts.skipJudge === true,
    keyword,
    articleExcerpt: stripTags(htmlAfter).slice(0, 8000),
    readerBrief: formatReaderBriefForPrompt(wieCtx?.readerBrief),
    synthesisSummary: formatCompetitorSynthesisForPrompt(wieCtx?.synthesis || null).slice(0, 2000),
    policySummary: formatPolicyBundleForPrompt(wieCtx?.policy).slice(0, 1500),
    competitorExcerpts: competitorDocs.map((c) => ({
      label: c.label,
      text: (c.plain || c.title || '').slice(0, 1500),
    })),
  });
  if (judge.status === 'ok') tokens += judge.tokens;
  // Benchmark stays heuristic-only (no Judge override of winners)
  await writeFile(path.join(outDir, 'editorial.json'), JSON.stringify(judge, null, 2), 'utf-8');
  if (benchmark) {
    await writeFile(path.join(outDir, 'benchmark.json'), JSON.stringify(benchmark, null, 2), 'utf-8');
  }

  const publishGate = evaluatePublishGate(htmlAfter, { explainability });
  const rootHeuristic = scoreRootIntentCoverage(htmlAfter);
  const rootIntent = {
    ...rootHeuristic,
    score: judge.status === 'ok'
      ? Math.round((rootHeuristic.score + judge.result.root_intent_coverage) / 2)
      : rootHeuristic.score,
  };
  const policyCompliance = evaluatePolicyCompliance({
    html: htmlAfter,
    explainability,
  });
  await writeFile(path.join(outDir, 'publishGate.json'), JSON.stringify(publishGate, null, 2), 'utf-8');
  await writeFile(path.join(outDir, 'policyCompliance.json'), JSON.stringify(policyCompliance, null, 2), 'utf-8');

  // ── Scorecard ──────────────────────────────────────────────────
  const eeat = scoreEeat(htmlAfter);
  const jCats = judge.status === 'ok' ? judge.result.categories : null;
  // Mild RX penalty for lead/long paras (Judge score remains primary; −5 not −10)
  let readerExp = jCats ? scale10to100(jCats.reader_experience.score) : 50;
  if (publishGate.blockers.some((b) => b.id === 'encyclopedic_lead')) {
    readerExp = Math.max(0, readerExp - 5);
  }
  if (publishGate.blockers.some((b) => b.id === 'long_paragraphs')) {
    readerExp = Math.max(0, readerExp - 5);
  }
  const decisionCount = explainability.filter((e) => /^(opening|examples|expert|cta)/i.test(e.decision)).length
    || explainability.length;
  const avgEff = explainability.length
    ? explainability.reduce((s, e) => s + (e.effectiveness || 0), 0) / explainability.length
    : undefined;
  const compliancePassRate = (policyCompliance.passed + policyCompliance.failed) > 0
    ? policyCompliance.passed / (policyCompliance.passed + policyCompliance.failed)
    : undefined;
  const scorecard = computeWritingIntelligence({
    readerExperience: readerExp,
    narrative: jCats ? scale10to100(jCats.narrative.score) : 50,
    expertVoice: jCats ? scale10to100(jCats.expert_voice.score) : scale10to100(eeat.expertise / 10),
    informationGain: jCats
      ? Math.round((scale10to100(jCats.information_gain.score) + scale10to100(rootIntent.score)) / 2)
      : scale10to100(rootIntent.score),
    seo: scoresAfter.seo,
    coverage: coverageScoreFromSnapshot({ total: coverageTotal, covered: coverageCovered }),
    eeat: eeat.score,
    patternUsage: patternUsageScore({
      patternIdsUsed: patternIds,
      decisionCount,
      avgEffectiveness: avgEff,
      compliancePassRate,
    }),
  });
  await writeFile(path.join(outDir, 'scorecard.json'), JSON.stringify(scorecard, null, 2), 'utf-8');

  const beatsTop5 = reconcileBeatsTop5({
    benchmark,
    judgeOverall: judge.status === 'ok' ? judge.result.vs_top5.overall : undefined,
  });

  // ── Reports ────────────────────────────────────────────────────
  const techMd = buildTechnicalMarkdown({
    runId,
    keyword,
    articleId,
    domainId,
    timings,
    tokens,
    scoresBefore,
    scoresAfter,
    termsCount: terms.length,
    competitorsCount: competitors.length,
    coverageTotal,
    coverageCovered,
    rxVetoes,
    pipelineOk,
    errors,
    logs: logs.map((l) => `+${l.t}ms ${l.msg}`),
    articleHtmlBefore: htmlBefore,
    articleHtmlAfter: htmlAfter,
  });
  const edMd = buildEditorialMarkdown({
    runId,
    keyword,
    scorecard,
    judge,
    benchmark,
    explainability,
    dnaVersion,
    pipelineOk,
    articleHtml: htmlAfter,
    publishGate,
    rootIntent,
    beatsTop5,
    policyCompliance,
  });
  const verdict = buildVerdictJson({
    scorecard,
    pipelineOk,
    judge,
    benchmark,
    publishGate,
    rootIntent,
    policyCompliance,
  });
  // Ensure verdict beats matches reconciled
  verdict.beats_top5 = beatsTop5;

  await writeFile(path.join(outDir, 'technical.md'), techMd, 'utf-8');
  await writeFile(path.join(outDir, 'editorial.md'), edMd, 'utf-8');
  await writeFile(path.join(outDir, 'verdict.json'), JSON.stringify(verdict, null, 2), 'utf-8');
  await writeFile(
    path.join(outDir, 'meta.json'),
    JSON.stringify({
      runId,
      articleId,
      keyword,
      domainId,
      timings,
      tokens,
      at: new Date().toISOString(),
    }, null, 2),
    'utf-8',
  );
  await writeFile(
    path.join(outDir, 'logs.jsonl'),
    logs.map((l) => JSON.stringify(l)).join('\n') + '\n',
    'utf-8',
  );

  await appendHistory({
    runId,
    at: new Date().toISOString(),
    keyword,
    articleId,
    writing_intelligence: scorecard.writingIntelligence,
    seo: scoresAfter.seo,
    ai: scoresAfter.ai,
    beats_top5: verdict.beats_top5,
    dna_version: dnaVersion,
  });
  await writeTrendsFile(undefined, { keyword });

  log(`done WI=${scorecard.writingIntelligence} beats=${verdict.beats_top5}`);

  return {
    runId,
    articleId,
    keyword,
    outDir,
    writingIntelligence: scorecard.writingIntelligence,
    pipelineOk,
    beats_top5: verdict.beats_top5,
    paths: {
      technical: path.join(outDir, 'technical.md'),
      editorial: path.join(outDir, 'editorial.md'),
      verdict: path.join(outDir, 'verdict.json'),
      afterHtml: path.join(outDir, 'article.after.html'),
    },
  };
}
