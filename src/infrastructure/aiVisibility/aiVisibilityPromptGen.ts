/**
 * LLM-generated tracker prompts, via the shared gateway (OpenRouter first).
 *
 * Thin on purpose: the prompt text, the parser and the eliciting-question filter are pure
 * and live in core/domain/aiVisibility/trackerPrompts. This adds the call and the failure
 * policy — returns null rather than throwing, so the caller keeps its existing fallbacks
 * instead of turning a generation hiccup into a 500.
 */
import { llmGateway } from '@/src/infrastructure/ai/llmGateway';
import { getErrorMessage } from '@/src/core/shared/errors';
import {
   AI_VIS_PROMPTS_PER_TOPIC,
   buildTrackerPromptRequest,
   parseTrackerPrompts,
   type TrackerPromptSeed,
} from '@/src/core/domain/aiVisibility/trackerPrompts';

/** Low but not zero: the use cases should be varied, the shape should not drift. */
const TEMPERATURE = 0.5;

/**
 * The gateway allows 180s per attempt, two attempts, across three providers — up to about
 * eighteen minutes if an upstream hangs. The caller has a fallback that costs nothing, so
 * waiting that long is never the right trade: give up and let it take over.
 */
const GENERATION_BUDGET_MS = 45_000;

const timeout = (ms: number): Promise<null> => new Promise((resolve) => {
   const t = setTimeout(() => resolve(null), ms);
   // Do not hold a serverless invocation (or a test worker) open on this timer.
   if (typeof t === 'object' && t && 'unref' in t) (t as { unref: () => void }).unref();
});

export async function generateTrackerPrompts(seed: TrackerPromptSeed): Promise<string[] | null> {
   const { system, user } = buildTrackerPromptRequest(seed);
   try {
      const gw = await Promise.race([llmGateway({
         // OpenRouter first; the gateway falls through to its other providers on 402/5xx.
         provider: 'openrouter',
         temperature: TEMPERATURE,
         responseFormat: 'json_object',
         maxTokens: 700,
         jobType: 'ai_vis_prompt_gen',
         keyword: seed.topic,
         messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
         ],
      }), timeout(GENERATION_BUDGET_MS)]);
      if (!gw) {
         console.warn(`[ai-vis prompt-gen] gave up after ${GENERATION_BUDGET_MS}ms for "${seed.topic}"`);
         return null;
      }
      const prompts = parseTrackerPrompts(gw.text, AI_VIS_PROMPTS_PER_TOPIC);
      // A short list is worse than none: the caller's fallback covers the topic, while a
      // half-filled pool would be cached and freeze the topic on one or two prompts.
      return prompts.length === AI_VIS_PROMPTS_PER_TOPIC ? prompts : null;
   } catch (e) {
      console.warn('[ai-vis prompt-gen] generation failed:', getErrorMessage(e));
      return null;
   }
}

export default generateTrackerPrompts;
