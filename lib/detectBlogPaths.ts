// lib/detectBlogPaths.ts
/** Pure URL→blog-segment clustering for blog detection (P3d). Signal sampling
 *  (Article schema / <article> / RSS) is layered on top in the API endpoint. */

export interface SegmentCandidate {
  segment: string;       // content segment, e.g. "blog"
  slugChildren: number;  // count of /<segment>/<slug> children with a slug-like child
  avgSlugLen: number;    // average length of those child slugs (longer ⇒ more article-like)
  dateShare: number;     // fraction of children whose path carries a year (article-ish)
  score: number;         // composite ranking score (higher = more blog-like)
}

const WRAPPER = new Set(['en', 'pl', 'de', 'fr', 'es', 'category', 'tag', 'page']);
const KNOWN_BLOG = new Set([
  'blog', 'news', 'articles', 'article', 'posts', 'post',
  'poradnik', 'academy', 'knowledge', 'insights', 'wpisy',
]);

function firstContentSegment(pathname: string): { seg: string; child: string; dated: boolean } | null {
  const parts = pathname.split('/').map((s) => s.trim().toLowerCase()).filter(Boolean);
  let i = 0;
  while (i < parts.length && WRAPPER.has(parts[i])) i += 1;
  if (i >= parts.length - 1) return null; // need a segment AND a child slug
  const seg = parts[i];
  const rest = parts.slice(i + 1);
  const dated = rest.some((p) => /^(19|20)\d{2}$/.test(p)); // a /YYYY/ segment after the blog segment
  // the "child slug" is the first non-date segment after the blog segment
  const child = rest.find((p) => !/^(19|20)\d{2}$/.test(p) && !/^\d{1,2}$/.test(p)) ?? rest[0];
  return { seg, child, dated };
}

/** Rank path segments by a weighted blog-likeness score (child count, slug length,
 *  date share, and a known-blog-name bonus). */
export function rankBlogSegments(urls: string[]): SegmentCandidate[] {
  const acc = new Map<string, { count: number; slugLenSum: number; dated: number }>();
  for (const url of urls) {
    let pathname: string;
    try { pathname = new URL(url).pathname; } catch { continue; }
    const fc = firstContentSegment(pathname);
    if (!fc) continue;
    // slug-like = contains a hyphen or is reasonably long (article slug, not "a"/"b")
    const slugLike = fc.child.includes('-') || fc.child.length >= 8;
    if (!slugLike) continue;
    const cur = acc.get(fc.seg) ?? { count: 0, slugLenSum: 0, dated: 0 };
    cur.count += 1;
    cur.slugLenSum += fc.child.length;
    if (fc.dated) cur.dated += 1;
    acc.set(fc.seg, cur);
  }
  return [...acc.entries()]
    .map(([segment, v]) => {
      const avgSlugLen = v.slugLenSum / v.count;
      const dateShare = v.dated / v.count;
      const score = v.count * 10 + avgSlugLen + dateShare * 12 + (KNOWN_BLOG.has(segment) ? 15 : 0);
      return { segment, slugChildren: v.count, avgSlugLen, dateShare, score };
    })
    .filter((c) => c.slugChildren >= 2)
    .sort((a, b) => b.score - a.score);
}
