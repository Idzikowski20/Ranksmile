// POST /api/articles/generate-outline
// Generates a ready-to-use brief from competitor structures + brand + AI gaps.
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { resolveOrgId, orgBudgetBlocked, recordAiTokens } from '../../../lib/aiBudget';
import type { CompetitorOutline } from '../../../components/articles/ResearchOutlinePanel';
import { getErrorMessage } from '../../../lib/errors';
import db from '../../../database/database';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { queryOne } from '../../../lib/db/query';
import { readContentSettings } from '../../../lib/contentSettings';
import { getDomainVoices } from '../../../lib/domainVoices';
import { assertArticleAccess } from '../../../lib/tenancy';
import { getCurrentUserId } from '../../../utils/getUser';
import { safeJsonParse } from '../../../lib/safeJson';
import type { CoverageSnapshot } from '../../../lib/aiCoverage';
import { resolveContentLocale, languageDisplayName } from '../../../lib/domainLanguage';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { chatLlm } from '../../../lib/ai/deepseek';

type CachedOutlines = { competitors?: CompetitorOutline[] };

function formatCompetitorStructures(competitors: CompetitorOutline[]): string {
  return competitors.map((c, i) => {
    const headings = (c.headings || [])
      .slice(0, 40)
      .map((h) => `${'  '.repeat(Math.max(0, h.level - 1))}H${h.level}: ${h.text}`)
      .join('\n');
    const stats = [
      c.word_count ? `${c.word_count} words` : null,
      c.heading_count ? `${c.heading_count} headings` : null,
    ].filter(Boolean).join(', ');
    return `### Competitor ${i + 1}: ${c.title}${stats ? ` (${stats})` : ''}\n${headings}`;
  }).join('\n\n');
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    keyword,
    competitors = [],
    language,
    currentHeadings = [],
    articleId,
    paaQuestions = [],
    missingFacts = [],
  } = req.body as {
    keyword: string;
    competitors: CompetitorOutline[];
    language?: string;
    currentHeadings?: Array<{ level: number; text: string }>;
    articleId?: number;
    paaQuestions?: string[];
    missingFacts?: string[];
  };
  if (!keyword) return res.status(400).json({ error: 'keyword is required' });

  const locale = await resolveContentLocale({ articleId: articleId ? Number(articleId) : undefined, bodyLanguage: language });
  const lang = languageDisplayName(locale.languageCode);

  const llm = chatLlm();
  if (!llm.apiKey) return res.status(500).json({ error: `${llm.keyEnv} not configured` });

  const orgId = await resolveOrgId(req, res);
  const over = await orgBudgetBlocked(orgId);
  if (over) return res.status(429).json(over);

  let compList = competitors;
  let brandKnowledge = '';
  let voiceTone = '';

  if (articleId) {
    const userId = await getCurrentUserId(req, res);
    if (!(await assertArticleAccess(userId, Number(articleId)))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    await ensureArticlesTables();
    const articleIdSql = await getArticleIdSql();
    const row = await queryOne<{
      competitor_outlines_cache: string | null;
      domain_id: number | null;
      ai_info_to_cover: string | null;
    }>(
      `SELECT competitor_outlines_cache, domain_id, ai_info_to_cover FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      [articleId],
    );
    if (!compList.length && row?.competitor_outlines_cache) {
      const cached = safeJsonParse<CachedOutlines>(row.competitor_outlines_cache, {});
      compList = cached.competitors || [];
    }
    try {
      const cs = await readContentSettings();
      brandKnowledge = cs.brandKnowledge || '';
      if (row?.domain_id) {
        const voices = await getDomainVoices(row.domain_id);
        voiceTone = voices.find((v) => v.isDefault)?.description || voices[0]?.description || '';
      }
    } catch { /* optional */ }
    if (!missingFacts.length && row?.ai_info_to_cover) {
      const snap = safeJsonParse<CoverageSnapshot | null>(row.ai_info_to_cover, null);
      const gaps = (snap?.items || []).filter((i) => !i.covered).slice(0, 12).map((i) => i.label);
      missingFacts.push(...gaps);
    }
  }

  const competitorSummary = formatCompetitorStructures(compList);
  const competitorHeadingCounts = compList
    .map((c) => c.heading_count || (c.headings || []).length || 0)
    .filter((n) => n > 0);
  const competitorAvg = competitorHeadingCounts.length > 0
    ? Math.round(competitorHeadingCounts.reduce((s, n) => s + n, 0) / competitorHeadingCounts.length)
    : 18;
  // Floor 16 / ceiling 20 — thin outlines lose to SERP pages with 20–27 headings.
  const targetHeadings = Math.min(20, Math.max(16, competitorAvg));

  const currentHeadingsSummary = currentHeadings.length > 0
    ? `\nCURRENT ARTICLE HEADINGS (already written — do NOT repeat these):\n${currentHeadings.map((h) => `H${h.level}: ${h.text}`).join('\n')}\n\nFOCUS: Emphasise MISSING topics not yet covered.\n`
    : '';

  const brandBlock = [brandKnowledge && `Brand knowledge: ${brandKnowledge}`, voiceTone && `Tone of voice: ${voiceTone}`]
    .filter(Boolean).join('\n');
  const aiGaps = [
    ...paaQuestions.slice(0, 8).map((q) => `- ${q}`),
    ...missingFacts.slice(0, 10).map((f) => `- ${f}`),
  ];
  const aiBlock = aiGaps.length
    ? `\nAI SEARCH GAPS (sections or subsections should address these):\n${aiGaps.join('\n')}\n`
    : '';

  let wieBlock = '';
  try {
    const { buildWieWriteContext, formatWieWriteBlocks } = await import('../../../lib/wie/writerContext');
    const scoreData = articleId
      ? await (async () => {
          const { queryOne } = await import('../../../lib/db/query');
          const { getArticleIdSql } = await import('../../../lib/articleSql');
          const idSql = await getArticleIdSql();
          const r = await queryOne<{ score_data: string | null }>(
            `SELECT score_data FROM articles WHERE ${idSql} = ? LIMIT 1`,
            [articleId],
          );
          if (!r?.score_data) return null;
          try { return JSON.parse(r.score_data) as { competitor_synthesis?: unknown }; } catch { return null; }
        })()
      : null;
    const wie = await buildWieWriteContext({
      keyword,
      paa: paaQuestions,
      scoreData,
    });
    wieBlock = formatWieWriteBlocks(wie);
  } catch { /* optional */ }

  const prompt = `You are an expert SEO + AI Search content strategist. Create a READY-TO-USE article brief outline for keyword "${keyword}".

${brandBlock ? `BRAND CONTEXT:\n${brandBlock}\n` : ''}${wieBlock ? `\n${wieBlock}\n` : ''}
COMPETITOR STRUCTURES (what ranks — use as evidence, do NOT copy wording):
${competitorSummary || 'No competitor data — use expertise for this keyword.'}
${currentHeadingsSummary}${aiBlock}
TASK:
1. Synthesise the median winning structure from competitors (they often have 15–27 headings)
2. Create ORIGINAL H1/H2/H3 headings — unique wording, better flow than competitors
3. Follow NARRATIVE beats / POLICY opening when provided (problem→explain→example→action)
4. Cover AI Search gaps where relevant (facts users/LLMs expect)
5. Match brand tone if provided
6. HARD REQUIREMENT: output EXACTLY ${targetHeadings} headings total (one H1, rest H2/H3). Never fewer than 16. Do not stop early.
7. Prefer depth: most H2s should have 1–3 H3 children where useful
8. Language: ${lang}

OUTPUT FORMAT — one heading per line only, no numbering, no bullets, no blank commentary:
H1: [title]
H2: [section]
H3: [subsection]
H2: [section]
...`;

  try {
    const response = await fetch(llm.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llm.apiKey}` },
      body: JSON.stringify({
        model: llm.model,
        max_tokens: 2800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[generate-outline] LLM error:', err);
      return res.status(500).json({ error: 'AI request failed' });
    }

    const data = await response.json();
    void recordAiTokens(orgId, data.usage?.total_tokens || 0);
    const text: string = data.choices?.[0]?.message?.content || '';

    const headings: Array<{ level: number; text: string }> = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      const m = trimmed.match(/^H([1-4]):\s*(.+)$/i);
      if (m) headings.push({ level: parseInt(m[1], 10), text: m[2].trim() });
    }

    if (headings.length === 0) {
      console.error('[generate-outline] could not parse output:', text.slice(0, 300));
      return res.status(500).json({ error: 'Could not parse generated outline — unexpected AI response format.' });
    }

    return res.status(200).json({ headings, usedBrand: !!(brandKnowledge || voiceTone), competitorCount: compList.length });
  } catch (err) {
    console.error('[generate-outline] error:', getErrorMessage(err));
    return res.status(500).json({ error: getErrorMessage(err) || 'Generation failed' });
  }
}

export default withOrgPaymentAccess(handler);
