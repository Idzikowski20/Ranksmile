// POST /api/articles/generate-outline
// Analyzes competitor outlines and generates an original, unique article outline using Claude.
// Input:  { keyword, competitors: CompetitorOutline[], language? }
// Output: { headings: Array<{ level: number; text: string }> }
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import type { CompetitorOutline } from '../../../components/articles/ResearchOutlinePanel';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { keyword, competitors = [], language = 'pl', currentHeadings = [] } = req.body as {
    keyword: string;
    competitors: CompetitorOutline[];
    language?: string;
    currentHeadings?: Array<{ level: number; text: string }>;
  };
  if (!keyword) return res.status(400).json({ error: 'keyword is required' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

  // Build competitor summary for the prompt
  const competitorSummary = competitors
    .map((c, i) => {
      const headings = c.headings
        .slice(0, 30)
        .map((h) => `${'  '.repeat(h.level - 1)}H${h.level}: ${h.text}`)
        .join('\n');
      return `### Competitor ${i + 1}: ${c.title}\n${headings}`;
    })
    .join('\n\n');

  // Median heading count from competitors
  const avgHeadings = competitors.length > 0
    ? Math.round(competitors.reduce((s, c) => s + (c.heading_count || c.headings.length), 0) / competitors.length)
    : 12;

  const lang = language === 'pl' ? 'Polish' : 'English';

  const currentHeadingsSummary = (currentHeadings as Array<{ level: number; text: string }>).length > 0
    ? `\nCURRENT ARTICLE HEADINGS (already written — do NOT repeat these):\n${(currentHeadings as Array<{ level: number; text: string }>).map((h) => `H${h.level}: ${h.text}`).join('\n')}\n\nFOCUS: Generate a complete outline that emphasises the MISSING topics — sections not yet covered by the current article.\n`
    : '';

  const prompt = `You are an expert SEO content strategist. Analyze these competitor outlines for the keyword "${keyword}" and create a UNIQUE, ORIGINAL article outline.

COMPETITOR OUTLINES:
${competitorSummary || 'No competitor data available — use your expertise for this keyword.'}
${currentHeadingsSummary}
TASK:
1. Identify the most important topics covered across competitors (their "median" structure)
2. Create an ORIGINAL outline covering the same important topics but with UNIQUE headings — never copy wording from competitors
3. Improve on competitors: fill gaps they missed, reorder for better flow, add value
4. Target ~${avgHeadings} headings total (H1 + H2 + H3 mix)
5. Language: ${lang}

OUTPUT FORMAT — strictly follow this, one heading per line, no other text:
H1: [title]
H2: [section]
H3: [subsection]
H2: [section]
...`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[generate-outline] DeepSeek error:', err);
      return res.status(500).json({ error: 'AI request failed' });
    }

    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content || '';

    // Parse H1/H2/H3/H4 lines
    const headings: Array<{ level: number; text: string }> = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      const m = trimmed.match(/^H([1-4]):\s*(.+)$/i);
      if (m) {
        headings.push({ level: parseInt(m[1], 10), text: m[2].trim() });
      }
    }

    if (headings.length === 0) {
      console.error('[generate-outline] could not parse output:', text.slice(0, 300));
      return res.status(500).json({ error: 'Could not parse generated outline — unexpected AI response format.' });
    }

    console.log(`[generate-outline] generated ${headings.length} headings for "${keyword}"`);
    return res.status(200).json({ headings });
  } catch (err: any) {
    console.error('[generate-outline] error:', err?.message);
    return res.status(500).json({ error: err?.message || 'Generation failed' });
  }
}
