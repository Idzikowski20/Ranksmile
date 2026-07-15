const MAX_PARAGRAPH_CHARS = 250;

export function structureIssues(html: string): string[] {
  const issues: string[] = [];
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  paras.forEach((m, idx) => {
    const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length > MAX_PARAGRAPH_CHARS) {
      issues.push(`paragraph ${idx + 1} is ${text.length} chars (max ${MAX_PARAGRAPH_CHARS})`);
    }
  });
  return issues;
}
