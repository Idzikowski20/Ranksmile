const MAX_PARAGRAPH_CHARS = 700;
/** Headings with almost no body text right after them = bot/thin structure. */
const MIN_SECTION_BODY_CHARS = 180;

export function structureIssues(html: string): string[] {
  const issues: string[] = [];
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  paras.forEach((m, idx) => {
    const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length > MAX_PARAGRAPH_CHARS) {
      issues.push(`paragraph ${idx + 1} is ${text.length} chars (max ${MAX_PARAGRAPH_CHARS}) — split into 2–3 readable paragraphs, do NOT add a new heading for each`);
    }
  });

  const headings = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  if (headings.length > 18) {
    issues.push(`too many headings (${headings.length}) — merge thin sections; prefer ~6–14 H2 for a long article`);
  }

  // Thin heading spam: H2/H3 followed by <180 chars of prose before next heading
  for (let i = 0; i < headings.length; i += 1) {
    const start = headings[i].index ?? 0;
    const end = i + 1 < headings.length ? (headings[i + 1].index ?? html.length) : html.length;
    const sectionHtml = html.slice(start, end);
    const body = sectionHtml
      .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const level = Number(headings[i][1]);
    if (level >= 2 && body.length > 0 && body.length < MIN_SECTION_BODY_CHARS) {
      issues.push(
        `heading "${headings[i][2].replace(/<[^>]+>/g, '').trim().slice(0, 48)}" has only ${body.length} chars of body — expand to a full section (several paragraphs) or merge into previous section`,
      );
    }
  }

  return issues.slice(0, 12);
}
