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

export async function generateTrackerPrompts(seed: TrackerPromptSeed): Promise<string[] | null> {
   const { system, user } = buildTrackerPromptRequest(seed);
   try {
      const gw = await llmGateway({
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
      });
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
