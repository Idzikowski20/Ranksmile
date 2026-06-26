// lib/blogPaths.ts
/** Helpers for blog-path detection + matching (P3d blog audit). */

const LOCALE_OR_WRAPPER = new Set([
  'en', 'pl', 'de', 'fr', 'es', 'it', 'nl', 'pt', 'cs', 'ru', 'uk',
  'category', 'categories', 'kategoria', 'tag', 'tags',
]);

/** Path segments of a URL or path string, lowercased, blanks removed. */
function segments(urlOrPath: string): string[] {
  let pathname = urlOrPath;
  try {
    pathname = new URL(urlOrPath).pathname;
  } catch {
    // already a path like "/blog/post"
  }
  return pathname.split('/').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * Reduce user/detected prefixes to their distinguishing "blog segment".
 * "/en/blog/" → "blog", "/category/blog/" → "blog", "/poradnik/" → "poradnik".
 * Picks the first segment that is not a locale/category wrapper.
 */
export function normalizeBlogPaths(prefixes: string[]): string[] {
  const out: string[] = [];
  for (const prefix of prefixes) {
    const seg = segments(prefix).find((s) => !LOCALE_OR_WRAPPER.has(s));
    if (seg && !out.includes(seg)) out.push(seg);
  }
  return out;
}

/**
 * True when the URL is a post UNDER one of the blog segments: some path segment
 * equals a blog segment AND there is at least one more segment after it (the post slug).
 */
export function matchesBlogPath(url: string, blogSegments: string[]): boolean {
  if (blogSegments.length === 0) return false;
  const segs = segments(url);
  for (let i = 0; i < segs.length; i += 1) {
    if (blogSegments.includes(segs[i]) && i < segs.length - 1) return true;
  }
  return false;
}
