// POST /api/articles/surfy-agent
// Multi-step Surfy agent: read SEO tools + write tools over a server-side cheerio
// working copy of the article. STREAMS its tool steps + assistant text to the client
// as Server-Sent Events; a terminal `done` event carries the final HTML to apply.
import type { NextApiRequest, NextApiResponse } from 'next';
import { streamText, isStepCount } from 'ai';
import verifyUser from '../../../utils/verifyUser';
import { deepseek } from '../../../lib/ai/deepseek';
import { makeWorkingDoc, stripDataImages, restoreDataImages, stripSids } from '../../../lib/ai/workingDoc';
import { buildTools } from '../../../lib/ai/tools';
import { buildSystemPrompt } from '../../../lib/ai/systemPrompt';
import { sseEvent } from '../../../lib/ai/sse';
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

    // ── Switch to SSE: validations above already ran with JSON status codes. ──
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    const send = (event: string, data: unknown) => { res.write(sseEvent(event, data)); (res as any).flush?.(); };

    // Abort the model when the client disconnects (Stop button closes the socket).
    const ac = new AbortController();
    req.on('close', () => ac.abort());

    let runningTokens = 0;
    try {
      const result = streamText({
        model: deepseek('deepseek-chat'),
        system: buildSystemPrompt(ctx, outline),
        messages: [...priorTurns, { role: 'user' as const, content: prompt }],
        tools: buildTools(ctx),
        stopWhen: isStepCount(8),
        abortSignal: ac.signal,
        onStepFinish: ({ usage }) => {
          runningTokens = usage?.totalTokens ?? runningTokens;
          send('usage', { totalTokens: runningTokens });
        },
      });

      for await (const part of result.fullStream) {
        if (ac.signal.aborted) break;
        switch (part.type) {
          case 'text-delta': send('text', { delta: part.text }); break;
          case 'tool-call': send('step', { phase: 'start', tool: part.toolName }); break;
          case 'tool-result': send('step', { phase: 'end', tool: part.toolName }); break;
          case 'tool-error': send('step', { phase: 'error', tool: part.toolName }); break;
          case 'error': send('error', { error: String((part as any).error?.message || (part as any).error || 'stream error') }); break;
          default: break; // start/finish-step etc. → covered by onStepFinish + totalUsage
        }
      }

      const message = await Promise.resolve(result.text).catch(() => '');
      const finalUsage = await Promise.resolve(result.totalUsage).catch(() => undefined);

      let finalHtml = ctx.htmlDirty ? restoreDataImages(stripSids($.html()), map) : null;
      // Guard: never apply an article the agent accidentally emptied.
      if (finalHtml != null && finalHtml.replace(/<[^>]+>/g, '').trim().length === 0) {
        finalHtml = null;
        ctx.changelog.push({ tool: 'guard', summary: 'discarded empty result' });
      }

      console.log(`[surfy-agent] writes=${ctx.writeCount} tokens=${finalUsage?.totalTokens ?? runningTokens}`);

      send('done', {
        message,
        finalHtml,
        meta: ctx.meta,
        changed: Boolean(finalHtml) || Boolean(ctx.meta),
        changelog: ctx.changelog,
        pendingAction: ctx.pendingAction,
        usage: { totalTokens: finalUsage?.totalTokens ?? runningTokens },
      });
      res.end();
    } catch (streamErr: any) {
      if (!ac.signal.aborted) send('error', { error: streamErr?.message || 'agent failed' });
      res.end();
    }
  } catch (error: any) {
    console.error('[surfy-agent] error:', error);
    if (!res.headersSent) return res.status(500).json({ error: error?.message || 'Request failed' });
    return res.end();
  }
}
