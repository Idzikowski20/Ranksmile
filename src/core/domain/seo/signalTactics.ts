export const SIGNAL_TACTICS: Record<string, string> = {
  meta_quality:
    'Ensure the article has a strong <title> tag (50-60 chars, keyword near beginning). Write a compelling meta description (140-160 chars) that drives clicks. Use descriptive, keyword-rich H1.',
  content_depth:
    'Expand thin sections with specific data, examples, and actionable takeaways. Each major section should have 150-300 words of substantive, unique content that goes beyond generic advice.',
  eeat:
    'Demonstrate expertise: add placeholders for author credentials (e.g. "[Author Name], [qualification]"), cite reputable external sources where the input data supports it, include publication date if known. If author/sources are not available, insert neutral placeholder tags rather than inventing them.',
  freshness:
    'If the input data contains recent information, reference it with dates. Add time-sensitive context where factual. If no recent data is available, do not invent dates, statistics, or studies.',
  technical:
    'Ensure proper heading hierarchy (H1 > H2 > H3, no skips). Add descriptive alt text to all images. Use semantic HTML. Include structured internal links where anchor text is available.',
  competitiveness:
    'Match or exceed top competitors in comprehensiveness. Cover all subtopics they address. Differentiate with unique structure and organization rather than fabricated claims.',
};
