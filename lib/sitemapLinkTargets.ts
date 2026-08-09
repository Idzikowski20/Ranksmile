/**
 * Internal-link targets drawn from the client's own sitemap.
 *
 * The Writer's link allowlist was built only from `articles` rows already marked
 * published, so a domain that has not published through Ranksmile yet gets an empty list
 * and the article ships with zero internal links — which is what article 15 did, against
 * a reference article carrying nine. The client's site is right there in the sitemap the
 * audit already fetches; these are the pages a human would have linked.
 *
 * Pure on purpose: `gatherBlogUrls` reaches the database, and importing it here would
 * pull sequelize into the unit tests for this ranking.
 */
import { normalizeTerm } from './termUtils';

export type LinkTarget = { id: number; title: string; url: string };

/** Slug as a human-readable title: "/zdrada-malzenska-objawy/" -> "zdrada malzenska objawy". */
export function titleFromSlug(url: string): string {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return '';
  }
  const slug = path.split('/').filter(Boolean).pop() || '';
  return slug
    .replace(/\.(html?|php|aspx)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): string[] {
  return normalizeTerm(text).split(/\s+/).filter((w) => w.length >= 3);
}

function isHomepage(url: string): boolean {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') === '';
  } catch {
    return false;
  }
}

/**
 * The pages most worth linking for this keyword, strongest first.
 *
 * The prompt block only shows the first handful, so handing it whatever order the
 * sitemap happened to return would spend those slots on the privacy policy. Ranked by
 * how much of the keyword the slug actually carries; pages sharing nothing are dropped
 * rather than padded in, because an irrelevant link is worse than one fewer link.
 */
export function pickLinkTargets(opts: {
  urls: string[];
  keyword: string;
  /** The article's own future URL — linking a page to itself is not a link. */
  selfUrl?: string;
  limit?: number;
}): LinkTarget[] {
  const seeds = new Set(tokens(opts.keyword));
  if (seeds.size === 0) return [];
  const self = (opts.selfUrl || '').replace(/\/+$/, '');
  const seen = new Set<string>();

  const scored = opts.urls
    .map((url) => url.split('#')[0].split('?')[0])
    .filter((url) => {
      const key = url.replace(/\/+$/, '');
      if (!key || key === self || isHomepage(url) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((url) => {
      const title = titleFromSlug(url);
      const overlap = tokens(title).filter((w) => seeds.has(w)).length;
      return { url, title, overlap };
    })
    .filter((row) => row.title.length >= 3 && row.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.url.localeCompare(b.url));

  return scored
    .slice(0, opts.limit ?? 12)
    .map((row, i) => ({ id: -(i + 1), title: row.title, url: row.url }));
}
