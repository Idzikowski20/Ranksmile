// Strip emoji / pictographs from Surfy's CHAT reply text (never from article HTML — the article may
// legitimately use emojis). Defensive: the prompt already asks for emoji-free, minimalist prose.
export function stripEmoji(s: string): string {
  if (!s) return s;
  return s
    .replace(/\p{Extended_Pictographic}/gu, '') // emoji pictographs (check/circle/calendar/person …)
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')      // regional-indicator flag halves
    .replace(/[︎️‍]/g, '')         // variation selectors + ZWJ joiners
    .replace(/[ \t]{2,}/g, ' ')                    // collapse the gaps left behind
    .replace(/ +([,.!?:;)])/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .trim();
}
