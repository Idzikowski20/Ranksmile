/**
 * What a tracker prompt has to be, and how to ask an LLM for one.
 *
 * A tracker prompt only earns its cost if the answer NAMES BRANDS: the whole metric is
 * "how often do the answers name us, and how early". The reference tool's prompts are all
 * one shape — "which providers are recommended for <use case>" — and every one of them
 * comes back with a brand list, including the prompts where the tracked brand scores zero.
 *
 * Ours were eight fixed sentence frames with the topic substituted, so every topic got the
 * same list, and half of it could not name a brand at all: yes/no legal questions answer
 * with the law, and "related searches" are keyword strings nobody types into a chatbot.
 * Those prompts still sat in the mention-rate denominator, which depressed the score for a
 * reason that had nothing to do with visibility.
 *
 * Pure module: the prompt text, the parser and the filter live here so they can be tested
 * without a network call. The gateway call is in infrastructure/aiVisibility.
 */

/** Matches the reference tool: five per topic, each covering a different use case. */
export const AI_VIS_PROMPTS_PER_TOPIC = 5;

export type TrackerPromptSeed = {
   /** The tracked topic, e.g. "Biuro detektywistyczne". */
   topic: string;
   /** The brand being tracked — named so the model knows the market, not to favour it. */
   brand: string;
   /** Language for the generated prompts, e.g. "Polish (polski)". */
   language: string;
   /** Real questions Google surfaced for the topic — evidence of what people ask about. */
   observedQuestions: string[];
};

/**
 * A question that could plausibly make an assistant list providers.
 *
 * Used to filter what Google hands us before it becomes a prompt or seed evidence.
 * Deliberately conservative: it rejects rather than rewrites, because a bad prompt costs a
 * model call on every scan and distorts the rate forever after.
 */
export function isBrandElicitingPrompt(text: string): boolean {
   const t = text.trim();
   if (t.length < 12) return false;
   // A keyword string, not something a person types at an assistant ("detektyw cennik").
   if (!/[?]$/.test(t)) return false;
   // Yes/no openers answer with a rule or a fact and name nobody. In Polish a leading
   // "Czy" is the yes/no marker; English uses the auxiliaries.
   if (/^(czy|is|are|does|do|can|should|may)\b/i.test(t)) return false;
   // "Ile kosztuje…" gets a price range, not a shortlist.
   if (/^(ile\s+kosztuje|how\s+much)\b/i.test(t)) return false;
   return true;
}

const SYSTEM = [
   'You write prompts for an AI brand-visibility tracker.',
   'A prompt is only useful if an AI assistant answering it would NAME SPECIFIC COMPANIES.',
   'Every prompt must therefore ask which providers are recommended for a concrete use case.',
   '',
   'Rules:',
   '- Ask for providers: "which agencies/companies/firms/clinics/shops…", never for a definition, a price, or a yes/no ruling.',
   '- One distinct USE CASE per prompt — the specific job a customer needs done. Never repeat a use case.',
   '- Derive the use cases from the topic and the observed questions. Real services, not adjectives.',
   '- Never name the tracked brand or any competitor in a prompt. The answer must be free to pick.',
   '- Write what a person would actually type at an assistant: one natural sentence ending in a question mark.',
   '- If the topic is informational rather than a service someone buys, ask which companies or specialists people turn to for that situation.',
   '',
   'Return ONLY a JSON object: {"prompts": ["…", "…"]}. No prose, no markdown.',
].join('\n');

export function buildTrackerPromptRequest(seed: TrackerPromptSeed): { system: string; user: string } {
   const observed = seed.observedQuestions.filter(isBrandElicitingPrompt).slice(0, 8);
   const user = [
      `Topic: ${seed.topic}`,
      `Market context (the tracked brand — do NOT mention it): ${seed.brand}`,
      `Language: write every prompt in ${seed.language}.`,
      `Count: exactly ${AI_VIS_PROMPTS_PER_TOPIC} prompts.`,
      observed.length
         ? [
            '',
            'Questions people actually ask Google about this topic — use them to find the'
            + ' real use cases, do not copy them verbatim:',
            observed.map((q) => `- ${q}`).join('\n'),
         ].join('\n')
         : '\nNo observed questions available; infer the use cases from the topic itself.',
   ].join('\n');
   return { system: SYSTEM, user };
}

/**
 * Pull the prompt list out of a model response.
 *
 * Accepts the documented object and a bare array, because a model asked for JSON returns
 * either often enough. Rejects anything that is not a question, and de-duplicates
 * case-insensitively — two phrasings of one use case waste a scan slot.
 */
export function parseTrackerPrompts(raw: string, limit = AI_VIS_PROMPTS_PER_TOPIC): string[] {
   let parsed: unknown;
   try {
      parsed = JSON.parse(raw);
   } catch {
      // A fenced block or a sentence of preamble — take the outermost JSON we can find.
      const m = /[[{][\s\S]*[\]}]/.exec(raw);
      if (!m) return [];
      try { parsed = JSON.parse(m[0]); } catch { return []; }
   }
   const list = Array.isArray(parsed)
      ? parsed
      : (parsed as { prompts?: unknown })?.prompts;
   if (!Array.isArray(list)) return [];

   const seen = new Set<string>();
   return list
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().replace(/\s+/g, ' '))
      .filter((text) => text.endsWith('?') && text.length >= 12)
      .filter((text) => {
         const key = text.toLowerCase();
         if (seen.has(key)) return false;
         seen.add(key);
         return true;
      })
      .slice(0, limit);
}
