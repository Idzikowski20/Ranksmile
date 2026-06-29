// POST /api/articles/surfy-agent
// Multi-step Surfy agent: read SEO tools + write tools over a server-side cheerio
// working copy of the article, then return the final HTML for the client to apply.
import type { NextApiRequest, NextApiResponse } from 'next';
import { generateText, isStepCount } from 'ai';
import verifyUser from '../../../utils/verifyUser';
import { deepseek } from '../../../lib/ai/deepseek';
import { makeWorkingDoc, stripDataImages, restoreDataImages, stripSids } from '../../../lib/ai/workingDoc';
import { buildTools } from '../../../lib/ai/tools';
import { buildSystemPrompt } from '../../../lib/ai/systemPrompt';
import type { ToolCtx } from '../../../lib/ai/types';

// maxDuration 300: the route covers DeepSeek steps PLUS up to two sequential sidecar LLM
// calls (apply_readability), so it must be >= the sum of the action tool budgets (ACTION_TIMEOUT).
export const config = { maxDuration: 300, api: { responseLimit: '10mb' } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    prompt, content, keyword = '', scoreData = null, internalArticles = [],
    articleTitle = '', articleMetaDescription = '', history = [], articleId = null,
  } = req.body;
  if (!prompt || !content) return res.status(400).json({ error: 'prompt and content are required' });
  if (!process.env.DEEPSEEK_API_KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

  try {
    const { stripped, map } = stripDataImages(content as string);
    const { $, outline } = makeWorkingDoc(stripped);

    const ctx: ToolCtx = {
      $, keyword, scoreData, internalArticles, articleTitle, articleMetaDescription,
      changelog: [], htmlDirty: false, writeCount: 0, meta: null,
      articleId: articleId != null ? Number(articleId) : null, cache: {},
      pendingAction: null,
    };

    const priorTurns = (Array.isArray(history) ? history : [])
      .filter((h: any) => h && typeof h.message === 'string' && h.message.trim())
      .map((h: any) => ({ role: h.role === 'assistant' ? 'assistant' as const : 'user' as const, content: h.message }));

    const result = await generateText({
      model: deepseek('deepseek-chat'),
      system: buildSystemPrompt(ctx, outline),
      messages: [...priorTurns, { role: 'user' as const, content: prompt }],
      tools: buildTools(ctx),
      stopWhen: isStepCount(8),
    });

    let finalHtml = ctx.htmlDirty ? restoreDataImages(stripSids($.html()), map) : null;

    // Guard: never apply an article the agent accidentally emptied.
    if (finalHtml != null && finalHtml.replace(/<[^>]+>/g, '').trim().length === 0) {
      finalHtml = null;
      ctx.changelog.push({ tool: 'guard', summary: 'discarded empty result' });
    }

    console.log(`[surfy-agent] steps=${result.steps.length} writes=${ctx.writeCount} tokens=${result.usage?.totalTokens ?? '?'}`);

    return res.status(200).json({
      message: result.text,
      finalHtml,
      meta: ctx.meta,
      changed: Boolean(finalHtml) || Boolean(ctx.meta),
      changelog: ctx.changelog,
      steps: result.steps.length,
      pendingAction: ctx.pendingAction,
    });
  } catch (error: any) {
    console.error('[surfy-agent] error:', error);
    return res.status(500).json({ error: error?.message || 'Request failed' });
  }
}
