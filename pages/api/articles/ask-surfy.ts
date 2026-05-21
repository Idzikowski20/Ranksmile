// POST /api/articles/ask-surfy
// Analizuje lub edytuje treść artykułu przez DeepSeek API
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import type { ScoreData } from '../../../lib/contentScore';

export const config = { api: { responseLimit: '10mb' } };

function countOccurrences(text: string, term: string): number {
  if (!text || !term) return 0;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = text.match(new RegExp(escaped, 'gi'));
  return matches ? matches.length : 0;
}

function buildScoreContext(scoreData: ScoreData, plainText: string, htmlContent: string): string {
  if (!scoreData?.terms?.length) return '';

  // Compute current scores
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const headingCount = (htmlContent.match(/<h[1-3][^>]*>/gi) || []).length;
  const paragraphCount = (htmlContent.match(/<p[\s>]/gi) || []).length;

  const wordScore = Math.min(wordCount / Math.max(scoreData.words_target, 1), 1) * 30;
  const headingScore = Math.min(headingCount / Math.max(scoreData.headings_target, 1), 1) * 20;

  let paraScore = 0;
  let termsWeight = 50;
  if (scoreData.paragraphs_target) {
    paraScore = Math.min(paragraphCount / Math.max(scoreData.paragraphs_target, 1), 1) * 15;
    termsWeight = 35;
  }

  // Per-term coverage
  const termLines: string[] = [];
  let coveredCount = 0;
  let missingCount = 0;

  for (const t of scoreData.terms) {
    const actual = countOccurrences(plainText, t.term);
    const min = Math.max(1, Math.round(t.target_count * 0.7));
    const max = Math.round(t.target_count * 1.5);
    const covered = actual >= min && actual <= max;

    if (covered) coveredCount++;
    else if (actual === 0) missingCount++;

    const status = covered ? '✓' : actual === 0 ? '✗ MISSING' : actual > max ? '⚠ OVERUSE' : '⚠ LOW';
    termLines.push(`  ${status} "${t.term}" — target: ${t.target_count}, current: ${actual} (range: ${min}–${max})`);
  }

  const totalTerms = scoreData.terms.length;
  const totalScore = Math.round(wordScore + headingScore + paraScore +
    (scoreData.terms.reduce((sum, t) => {
      const actual = countOccurrences(plainText, t.term);
      return sum + Math.min(actual / Math.max(t.target_count, 1), 1);
    }, 0) / totalTerms) * termsWeight);

  return `CONTENT SCORE DATA
──────────────────
Current Score: ${totalScore}/100 (${totalScore >= 80 ? 'Good' : totalScore >= 50 ? 'Needs Improvement' : 'Poor'})

Structure Targets:
- Words: ${wordCount}/${scoreData.words_target} (min ${scoreData.words_min}, max ${scoreData.words_max}) — ${Math.round(wordScore)}/30 pts
- Headings: ${headingCount}/${scoreData.headings_target} (min ${scoreData.headings_min}, max ${scoreData.headings_max}) — ${Math.round(headingScore)}/20 pts${scoreData.paragraphs_target ? `
- Paragraphs: ${paragraphCount}/${scoreData.paragraphs_target} (min ${scoreData.paragraphs_min}, max ${scoreData.paragraphs_max}) — ${Math.round(paraScore)}/15 pts` : ''}

NLP Term Coverage (${coveredCount}/${totalTerms} covered, ${missingCount} missing):
${termLines.join('\n')}

IMPORTANT: Always consider how your changes affect the score. Adding headings, expanding text, or including missing NLP terms will IMPROVE the score. Removing headings, deleting paragraphs, or stripping keywords will HURT the score. Prioritize improvements that boost the score.`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, content, context = [], scoreData, internalArticles = [] } = req.body;
  if (!prompt || !content) return res.status(400).json({ error: 'prompt and content are required' });

  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

    // Strip HTML to get plain text for score analysis
    const plainText = content.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

    // Build score context if scoreData provided
    let extraContext = '';
    if (scoreData?.terms?.length) {
      extraContext += '\n\n' + buildScoreContext(scoreData, plainText, content);
    }

    // Build internal linking context
    if (internalArticles.length > 0) {
      extraContext += '\n\nINTERNAL LINKING TARGETS (articles you can link to):';
      for (const a of internalArticles) {
        extraContext += `\n- "${a.title}" → ${a.url || `/articles/${a.id}`}`;
      }
      extraContext += '\n\nWhen editing the article, insert relevant internal links using <a href="URL">anchor text</a>. Link naturally where the topic connects to another article. Use descriptive anchor text matching the target article\'s topic. Do not force links where they don\'t fit.';
    }

    const systemPrompt = `You are an expert SEO content editor and analyst. The user will send you an HTML article and ask a question or request edits.

YOUR RESPONSE MUST FOLLOW THIS FORMAT EXACTLY:

---
MESSAGE
(your natural language response — analysis, suggestions, explanation, etc. Write in the same language the user used. Be concise and actionable.)
MESSAGE_END

HTML
(if and ONLY if the user requested changes to the article, provide the COMPLETE modified HTML here — the entire article, not just the changed part. If the user only asked a question without requesting edits, leave this section empty)
HTML_END
---

CRITICAL RULES:
- The MESSAGE section is ALWAYS required
- The HTML section should ONLY contain content if the user explicitly asked for edits
- When providing HTML: preserve ALL existing structure (headings, paragraphs, lists, links, images) — only modify what was requested
- Do NOT wrap the HTML in markdown code blocks
- Write the message in the user's language

MESSAGE FORMATTING RULES:
- Use numbered lists (1. 2. 3.) for structured feedback and suggestions
- Use **bold** for key concepts, headings within points, and important terms (e.g. **SEO:**, **Struktura:**)
- Use backtick code formatting for HTML tags, CSS properties, and technical terms (e.g. \`<h1>\`, \`font-size\`)
- Separate distinct sections with a blank line
- Keep paragraphs short (2-3 sentences max)
- Be concise — prefer bullet-style points over long paragraphs
- Start with a 1-sentence overall assessment, then break into numbered areas of improvement${extraContext}`;

    const userMessage = `Article HTML:

${content}

---

User: ${prompt}`;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 32000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[ask-surfy] DeepSeek error:', err);
      return res.status(500).json({ error: 'AI request failed' });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';

    // Parse message and html sections
    const msgMatch = raw.match(/MESSAGE\s*\n?([\s\S]*?)\n?MESSAGE_END/i);
    const htmlMatch = raw.match(/HTML\s*\n?([\s\S]*?)\n?HTML_END/i);

    const message = msgMatch?.[1]?.trim() || raw.trim();
    let editedContent = htmlMatch?.[1]?.trim() || null;

    // Clean up HTML — remove markdown code fences
    if (editedContent) {
      editedContent = editedContent.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
      // If HTML section is empty or just whitespace, treat as no changes
      if (!editedContent || editedContent.length < 10) editedContent = null;
    }

    return res.status(200).json({ message, content: editedContent });
  } catch (error: any) {
    console.error('[ask-surfy] error:', error);
    return res.status(500).json({ error: error?.message || 'Request failed' });
  }
}
