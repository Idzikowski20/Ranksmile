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
import { extractJsonObject, isSurfyReplyShape } from '../../../lib/ai/extractJson';
import { stripEmoji } from '../../../lib/ai/text';
import { getCurrentUserId } from '../../../utils/getUser';
import { ensureUserTenancy } from '../../../lib/tenancy';
import { getOrgUsage5h, recordAiTokens } from '../../../lib/aiTokenUsage';
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
    authorName = '',
  } = req.body;
  if (!prompt || !content) return res.status(400).json({ error: 'prompt and content are required' });
  if (!process.env.DEEPSEEK_API_KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

  // ── Org-wide AI token budget (shared 5h pool). Block before doing any work if exhausted. ──
  let orgId: number | null = null;
  try { const uid = await getCurrentUserId(req, res); orgId = (await ensureUserTenancy(String(uid))).orgId; } catch { orgId = null; }
  if (orgId != null) {
    const usage = await getOrgUsage5h(orgId);
    if (usage.over) return res.status(429).json({ error: 'org_limit', resetsAt: usage.resetsAt, used: usage.used, limit: usage.limit });
  }

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
      const today = new Date().toISOString().slice(0, 10); // server clock — the model never guesses the date
      const result = streamText({
        model: deepseek('deepseek-chat'),
        system: buildSystemPrompt(ctx, outline, { today, authorName: typeof authorName === 'string' ? authorName : '' }),
        messages: [...priorTurns, { role: 'user' as const, content: prompt }],
        tools: buildTools(ctx),
        stopWhen: isStepCount(8),
        abortSignal: ac.signal,
        onStepFinish: ({ usage }) => {
          runningTokens = usage?.totalTokens ?? runningTokens;
          send('usage', { totalTokens: runningTokens });
        },
      });

      // Track the running text + where the LAST tool result landed so we can split the model's
      // between-step narration ("thinking") from its final answer (text after the last tool).
      let streamedText = '';
      let thinkingLen = 0;
      for await (const part of result.fullStream) {
        if (ac.signal.aborted) break;
        switch (part.type) {
          case 'text-delta': streamedText += part.text; send('text', { delta: part.text }); break;
          case 'tool-call': send('step', { phase: 'start', tool: part.toolName }); break;
          case 'tool-result': thinkingLen = streamedText.length; send('step', { phase: 'end', tool: part.toolName }); break;
          case 'tool-error': thinkingLen = streamedText.length; send('step', { phase: 'error', tool: part.toolName }); break;
          case 'error': send('error', { error: String((part as any).error?.message || (part as any).error || 'stream error') }); break;
          default: break; // start/finish-step etc. → covered by onStepFinish + totalUsage
        }
      }

      const fullText = (await Promise.resolve(result.text).catch(() => '')) || streamedText;
      // Answer = text after the last tool result; thinking = the narration before it (collapsed in UI).
      let thinking = stripEmoji(streamedText.slice(0, thinkingLen).trim());
      let message = streamedText.slice(thinkingLen).trim() || fullText;
      const finalUsage = await Promise.resolve(result.totalUsage).catch(() => undefined);

      let finalHtml = ctx.htmlDirty ? restoreDataImages(stripSids($.html()), map) : null;

      // The agent should use write tools + reply in prose, but deepseek-chat sometimes ignores the
      // tools and answers with a legacy {action,message,content} JSON blob. Normalize that: surface
      // the prose `message`, and if it carried full-article HTML (and no tool wrote), apply it.
      const parsedReply = extractJsonObject(message);
      if (isSurfyReplyShape(parsedReply) && parsedReply) {
        if (typeof parsedReply.message === 'string' && parsedReply.message.trim()) message = parsedReply.message;
        if (finalHtml == null && typeof parsedReply.content === 'string' && parsedReply.content.trim()) {
          finalHtml = restoreDataImages(parsedReply.content, map);
        }
      }
      // Minimalist, emoji-free chat reply (article HTML is left untouched).
      message = stripEmoji(message);

      // Guard: never apply an article the agent accidentally emptied.
      if (finalHtml != null && finalHtml.replace(/<[^>]+>/g, '').trim().length === 0) {
        finalHtml = null;
        ctx.changelog.push({ tool: 'guard', summary: 'discarded empty result' });
      }

      console.log(`[surfy-agent] writes=${ctx.writeCount} tokens=${finalUsage?.totalTokens ?? runningTokens}`);
      // Charge this turn against the org's shared 5h pool (best-effort).
      await recordAiTokens(orgId, finalUsage?.totalTokens ?? runningTokens);

      send('done', {
        message,
        thinking,
        finalHtml,
        meta: ctx.meta,
        changed: Boolean(finalHtml) || Boolean(ctx.meta),
        changelog: ctx.changelog,
        pendingAction: ctx.pendingAction,
        usage: {
          totalTokens: finalUsage?.totalTokens ?? runningTokens,
          inputTokens: finalUsage?.inputTokens ?? 0,
          outputTokens: finalUsage?.outputTokens ?? 0,
        },
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
