/**
 * Human-prose constraints for Auto-Optimize / content LLM prompts.
 * Adapted from Stop Slop (MIT) — https://github.com/hardikpandya/stop-slop
 * Author: Hardik Pandya
 *
 * Kept compact for token budget; full skill lives upstream.
 */

/** Block injected into AO system prompts — write like a human for humans. */
export const STOP_SLOP_RULES = `HUMAN PROSE (Stop Slop — write for people, not like an AI template):
- Cut filler and throat-clearing: "Here's the thing", "Here's what", "It's worth noting", "In today's world", "At its core", "When it comes to", "Furthermore", "In conclusion", "Delve into", "Let me walk you through", "In this section we'll"
- No emphasis crutches: "Full stop.", "Let that sink in", "Make no mistake", "This matters because"
- Avoid business jargon: navigate/unpack/lean into/landscape/game-changer/deep dive/moving forward/circle back — use plain words
- Prefer active voice with a clear human subject. Do not let inanimate nouns do human verbs ("the strategy emerges")
- Be specific. Kill vague declaratives ("The implications are significant", "The stakes are high") — name the concrete thing
- Address the reader when natural ("you"), not distant narrator voice ("people", "nobody", "one must")
- Vary sentence length. Prefer two items over three-item lists of parallel fluff. No em dashes (—)
- Do not start sentences with Wh- openers when a direct statement works better
- No "not X, it's Y" binary contrasts — state Y directly
- No pull-quote one-liners ending every paragraph. No meta-commentary about the essay itself
- Sound like a competent human editor writing for a smart reader — dense, direct, trustworthy`;

/** Append Stop Slop rules to an existing system-prompt fragment. */
export function withStopSlop(systemPrompt: string): string {
  const base = systemPrompt.trimEnd();
  if (base.includes('HUMAN PROSE (Stop Slop')) return base;
  return `${base}\n\n${STOP_SLOP_RULES}`;
}
