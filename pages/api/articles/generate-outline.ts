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

export const config = { maxDuration: 60 };

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

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
  const avgHeadings = compList.length > 0
    ? Math.round(compList.reduce((s, c) => s + (c.heading_count || c.headings.length), 0) / compList.length)
    : 12;

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

  const prompt = `You are an expert SEO + AI Search content strategist. Create a READY-TO-USE article brief outline for keyword "${keyword}".

${brandBlock ? `BRAND CONTEXT:\n${brandBlock}\n` : ''}
COMPETITOR STRUCTURES (what ranks — use as evidence, do NOT copy wording):
${competitorSummary || 'No competitor data — use expertise for this keyword.'}
${currentHeadingsSummary}${aiBlock}
TASK:
1. Synthesise the median winning structure from competitors
2. Create ORIGINAL H1/H2/H3 headings — unique wording, better flow than competitors
3. Cover AI Search gaps where relevant (facts users/LLMs expect)
4. Match brand tone if provided
5. Target ~${avgHeadings} headings total
6. Language: ${lang}

OUTPUT FORMAT — one heading per line only:
H1: [title]
H2: [section]
H3: [subsection]
...`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[generate-outline] DeepSeek error:', err);
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
