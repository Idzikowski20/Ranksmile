// POST /api/articles/ask-surfy
// Intelligent SEO content assistant — analyzes or edits article content via DeepSeek API.
// Supports: selection mode (bubble menu), article mode (top toolbar), slash commands, and scoring.
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import type { ScoreData } from '../../../lib/contentScore';
import { countOccurrences } from '../../../lib/contentScore';
import { SIGNAL_TACTICS } from '../../../lib/seo/signalTactics';
import { ANTI_HALLUCINATION_RULES } from '../../../lib/seo/antiHallucinationRules';
import { scoreContent } from '../../../lib/seo/scoreContentClient';

export const config = { api: { responseLimit: '10mb' } };

type SurfyAction =
  | 'analysis_only'
  | 'replace_selection'
  | 'replace_article'
  | 'insert_after_selection'
  | 'delete_selection'
  | 'optimize_selection'
  | 'optimize_article';

function detectSurfyAction(prompt: string, mode: 'selection' | 'article'): SurfyAction {
  const p = prompt.toLowerCase();

  if (/usuń|delete|remove|wywal/.test(p)) {
    return mode === 'selection' ? 'delete_selection' : 'replace_article';
  }

  if (/dodaj|add|dopisz|insert/.test(p)) {
    return mode === 'selection' ? 'insert_after_selection' : 'replace_article';
  }

  if (/sprawdź|check|score|oceń|analizuj/.test(p) && !/optymalizuj|optimize/.test(p)) {
    return 'analysis_only';
  }

  if (/optymalizuj|optimize|seo|popraw/.test(p)) {
    return mode === 'selection' ? 'optimize_selection' : 'optimize_article';
  }

  if (/przepisz|rewrite|napisz inaczej|edytuj|edit|zmień|change|rozwiń|expand|skróć|summarize/.test(p)) {
    return mode === 'selection' ? 'replace_selection' : 'replace_article';
  }

  return 'analysis_only';
}

function shouldUseScoring(prompt: string, action: SurfyAction): boolean {
  const p = prompt.toLowerCase();
  return (
    action === 'optimize_selection' ||
    action === 'optimize_article' ||
    /\b(score|seo|optymalizuj|optimize|ranking|x-algorithm|content score|oceń seo|sprawdź seo)\b/.test(p)
  );
}

function buildScoreContext(scoreData: ScoreData, plainText: string, htmlContent: string): string {
  if (!scoreData?.terms?.length) return '';

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

  const { prompt, content, mode = 'article', selectedText = null, selectionRange = null, scoreData, internalArticles = [], keyword = '', articleTitle = '', articleMetaDescription = '' } = req.body;
  if (!prompt || !content) return res.status(400).json({ error: 'prompt and content are required' });

  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

    const action = detectSurfyAction(prompt, mode as 'selection' | 'article');

    // ── Scoring awareness (only when needed) ───────────────────────
    let scoringBlock = '';
    if (shouldUseScoring(prompt, action) && keyword && process.env.DEEPSEEK_API_KEY) {
      try {
        const scoreResult = await scoreContent(
          content as string,
          keyword as string,
          scoreData || {},
          articleTitle || '',
          articleMetaDescription || ''
        );

        if (scoreResult?.ranking_signals?.signals?.length) {
          const weakSignals = [...scoreResult.ranking_signals.signals]
            .sort((a: any, b: any) => a.score - b.score)
            .slice(0, 3);

          scoringBlock = `
RANKING SCORE: ${scoreResult.ranking_score}/100

WEAKEST SIGNALS:
${weakSignals.map((s: any, i: number) =>
  `${i + 1}. ${s.name}: ${s.score}/100 (${s.verdict}) — ${s.recommendation || 'needs improvement'}
   HOW TO FIX: ${SIGNAL_TACTICS[s.name] || 'Improve this signal.'}`
).join('\n\n')}

${action === 'analysis_only'
  ? 'Report these findings to the user. Do NOT modify the content.'
  : 'Use these signals to guide your optimization. Focus on improving the weakest signals.'}`;
        }
      } catch (err: any) {
        console.log('[ask-surfy] scoring failed (non-fatal):', err.message);
      }
    }

    // ── Build system prompt ─────────────────────────────────────────
    const plainText = content.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

    let extraContext = '';
    if (scoreData?.terms?.length) {
      extraContext += '\n\n' + buildScoreContext(scoreData, plainText, content);
    }
    if (internalArticles.length > 0) {
      extraContext += '\n\nINTERNAL LINKING TARGETS (articles you can link to):';
      for (const a of internalArticles) {
        extraContext += `\n- "${a.title}" → ${a.url || `/articles/${a.id}`}`;
      }
      extraContext += '\n\nWhen editing the article, insert relevant internal links using <a href="URL">anchor text</a>. Link naturally where the topic connects to another article. Use descriptive anchor text matching the target article\'s topic. Do not force links where they don\'t fit.';
    }

    const scopeBlock = mode === 'selection' && selectedText
      ? `MODE: selection\nYou are editing ONLY the selected fragment below. Do NOT modify anything outside it.\n\nSELECTED TEXT:\n---\n${selectedText}\n---\n\nFULL ARTICLE (for context only, do NOT edit unless asked):\n${content}\n\nIMPORTANT: Return content = the replacement HTML for the selected fragment ONLY, not the full article.`
      : `MODE: article\nYou may edit the full article if the user asks for changes.\n\nFULL ARTICLE:\n${content}`;

    const actionUnderstandingBlock = `You are Surfy, an intelligent SEO content assistant with deep understanding of user intent.

RECOGNIZE THESE USER INTENTS from the prompt (the user may use Polish or English):
- "Edytuj" / "Edit" / "Zmień" / "Change" → Modify the indicated text while keeping surrounding content intact
- "Usuń" / "Delete" / "Remove" / "Wywal" → Remove the indicated text from the article
- "Dodaj" / "Add" / "Dopisz" / "Insert" → Generate new content to add at the appropriate location
- "Przepisz" / "Rewrite" / "Napisz inaczej" → Replace with a different version, same meaning
- "Rozwiń" / "Expand" / "Rozbuduj" → Add more depth, examples, data to the existing text
- "Skróć" / "Summarize" / "Shorten" → Reduce length while preserving key points
- "Optymalizuj" / "Optimize" / "Popraw SEO" → Run SEO scoring analysis and suggest improvements
- "Sprawdź" / "Check" / "Score" / "Oceń" → Analyze and report, do NOT modify the text
- "Wyjaśnij" / "Explain" / "Co to" → Explain a concept, no text changes needed
- Questions ("?" at end) → Answer the question about the content, do NOT modify text
- General chat → Respond conversationally about the topic

ACTION: ${action}
${action === 'optimize_selection' || action === 'optimize_article'
  ? 'You SHOULD evaluate ranking signals and suggest improvements. Include a "signals" array in your response.'
  : action === 'analysis_only'
  ? 'Analyze and report. Do NOT modify content. content field must be null.'
  : `Expected output: content = ${mode === 'selection' ? 'replacement HTML for selected fragment' : 'full article HTML with changes applied'}`
}

RESPONSE FORMAT:
Return JSON with:
{
  "action": "${action}",
  "message": "Your conversational response (always include, even when returning HTML)",
  "content": "<HTML to apply>" | null
}

RULES:
- If the user is asking a question or chatting, set content=null and just respond in message
- In SELECTION mode: content = replacement HTML for selected fragment ONLY
- In ARTICLE mode: content = full article HTML (only if user asked for changes)
- For "delete_selection" action: content should be "" (empty string)
- For "insert_after_selection" action: content is the new HTML to insert after the selection
- NEVER change text the user didn't ask you to change
- NEVER invent facts, statistics, author credentials, or sources`;

    const systemPrompt = [
      actionUnderstandingBlock,
      scoringBlock,
      extraContext,
      scopeBlock,
      ANTI_HALLUCINATION_RULES,
    ].filter(Boolean).join('\n\n');

    const userMessage = mode === 'selection' && selectedText
      ? `User prompt: ${prompt}\n\n${scopeBlock}`
      : `Article HTML:\n\n${content}\n\n---\n\nUser: ${prompt}`;

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

    // Parse response — try JSON first, fall back to MESSAGE/HTML format
    let parsedAction = action;
    let message = '';
    let htmlContent: string | null = null;

    try {
      const parsed = JSON.parse(raw);
      parsedAction = parsed.action || action;
      message = parsed.message || '';
      htmlContent = parsed.content || null;
    } catch {
      const msgMatch = raw.match(/MESSAGE\s*\n?([\s\S]*?)\n?MESSAGE_END/i);
      const htmlMatch = raw.match(/HTML\s*\n?([\s\S]*?)\n?HTML_END/i);
      message = msgMatch?.[1]?.trim() || raw.trim();
      htmlContent = htmlMatch?.[1]?.trim() || null;
      if (htmlContent) {
        htmlContent = htmlContent.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
        if (!htmlContent || htmlContent.length < 10) htmlContent = null;
      }
    }

    return res.status(200).json({ action: parsedAction, message, content: htmlContent });
  } catch (error: any) {
    console.error('[ask-surfy] error:', error);
    return res.status(500).json({ error: error?.message || 'Request failed' });
  }
}
