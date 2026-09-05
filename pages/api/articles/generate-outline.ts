// POST /api/articles/generate-outline
// Generates a ready-to-use brief from competitor structures + brand + AI gaps.
import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveOrgId, orgBudgetBlocked, recordAiTokens } from '@/src/infrastructure/ai/aiBudget';
import { getErrorMessage } from '@/src/core/shared/errors';
import { ensureArticlesTables } from '@/src/infrastructure/persistence/schema/ensureArticlesTables';
import { getArticleIdSql } from '@/src/infrastructure/articles/articleSql';
import { queryOne } from '@/src/infrastructure/db/query';
import { readContentSettings } from '@/src/infrastructure/stores/contentSettings';
import { getDomainVoices } from '@/src/infrastructure/seo/domainVoices';
import { assertArticleAccess } from '@/src/infrastructure/identity/tenancy';
import { safeJsonParse } from '@/src/core/shared/safeJson';
import type { CoverageSnapshot } from '@/src/core/domain/coverage/aiCoverage';
import { resolveContentLocale, languageDisplayName } from '@/src/infrastructure/config/domainLanguage';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { chatLlm } from '@/src/infrastructure/ai/deepseek';
import { topicalizeH1 } from '@/src/core/domain/contentPlanner/sectionLabels';
import { getCurrentUserId } from '../../../utils/getUser';
import db from '../../../database/database';
import type { CompetitorOutline } from '../../../components/articles/ResearchOutlinePanel';
import verifyUser from '../../../utils/verifyUser';

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
  // Section count, not raw heading count. competitorAvg counts every H1–H4 a competitor
  // renders, including nesting; a flat-H2 informational article needs fewer top-level
  // sections than that. Surfer's own article for "szantaż emocjonalny" runs 12 H2 + H1
  // against a SERP whose pages show 20+ headings. Bound 10–16 and let the prompt land
  // where the topic needs rather than padding to the competitors' nested totals.
  const targetHeadings = Math.min(16, Math.max(10, Math.round(competitorAvg * 0.65)));

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
    const { buildWieWriteContext, formatWieWriteBlocks } = await import('@/src/infrastructure/wie/writerContext');
    const scoreData = articleId
      ? await (async () => {
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
1. Mirror the topical structure the ranking pages actually use — the same subjects, in a natural reading order (what it is → how it works → how to recognise it → types/examples → where it happens → how to respond → when to get help). Clean up their wording; do not invent compound "original" headings that no competitor has.
2. The H1 is a topical, reader-benefit title about "${keyword}" itself — e.g. "${keyword}: jak rozpoznać i jak sobie radzić". NEVER frame it around the company, an audience or a city (no "jak pomóc firmom", no city names, no brand). The brand is one section, not the subject of the article.
3. Headings are plain topical statements or questions ("Czym jest…", "Jak rozpoznać…", "Najczęstsze techniki…"), the way the ranking articles title them — not marketing or service-page phrasing.
4. Cover AI Search gaps where relevant (facts users/LLMs expect), folding each into the matching topical section.
5. If a brand is provided, give it AT MOST ONE section, near the end (before any FAQ/summary) — never the opening, never the H1, never the tone of the whole outline.
6. Output about ${targetHeadings} headings total (one H1, the rest H2). Match what the topic needs; do not pad.
7. Use H3 ONLY where a competitor genuinely nests one — most informational articles for this kind of keyword are flat H2 with no H3 at all, so prefer flat unless nesting is clearly warranted.
8. Language: ${lang}

OUTPUT FORMAT — one heading per line only, no numbering, no bullets, no blank commentary:
H1: [topical reader-benefit title about the keyword]
H2: [topical section]
H2: [topical section]
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

    // Deterministic guard: the model keeps titling the H1 for the brand ("…poufna pomoc
    // detektywistyczna dla osób prywatnych i firm z Warszawy") even when the prompt
    // forbids it, because the brand context outweighs the instruction. Strip that framing
    // so the H1 stays topical, the way Surfer titles it.
    const h1 = headings.find((h) => h.level === 1);
    if (h1) h1.text = topicalizeH1(h1.text, keyword);

    return res.status(200).json({ headings, usedBrand: !!(brandKnowledge || voiceTone), competitorCount: compList.length });
  } catch (err) {
    console.error('[generate-outline] error:', getErrorMessage(err));
    return res.status(500).json({ error: getErrorMessage(err) || 'Generation failed' });
  }
}

export default withOrgPaymentAccess(handler);
