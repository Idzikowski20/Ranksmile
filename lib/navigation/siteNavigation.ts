import type { SiteNavItem } from './navigationTypes';

/** Canonical SEO secondary links (primary nav + mobile sheet + command palette). */
export const SEO_NAV: SiteNavItem[] = [
  { id: 'performance', label: 'Performance', path: 'performance', match: '/performance', keywords: ['gsc', 'traffic'] },
  { id: 'site-audit', label: 'Site Audit', path: 'site-audit', match: '/site-audit', keywords: ['crawl', 'technical'] },
  { id: 'recommendations', label: 'Recommendations', path: 'recommendations', match: '/recommendations', keywords: ['optimize', 'actions'] },
  { id: 'content-audit', label: 'Content Audit', path: 'content-audit', match: '/content-audit', keywords: ['audit', 'content'] },
  { id: 'topical-map', label: 'Topical Map', path: 'topical-map', match: '/topical-map', keywords: ['topics', 'clusters'] },
  {
    id: 'search-intelligence',
    label: 'Search Intelligence',
    path: 'search-intelligence',
    match: '/search-intelligence',
    keywords: ['organic', 'keywords', 'serp', 'rank'],
  },
  { id: 'activity-log', label: 'Activity Log', path: 'activity-log', match: '/activity-log', keywords: ['history', 'log'] },
];

/** Tools secondary — Audit URL is Site Audit contextual only, not listed here. */
export const TOOLS_NAV: SiteNavItem[] = [
  { id: 'keyword-research', label: 'Keyword Research', path: 'keyword-research', match: '/keyword-research', keywords: ['keywords', 'seed'] },
  { id: 'topic-research', label: 'Topic Research', path: 'topic-research', match: '/topic-research', keywords: ['brief', 'research'] },
];

export const AI_VISIBILITY_NAV: SiteNavItem[] = [
  { id: 'ai-overview', label: 'Overview', path: 'ai-visibility/overview', match: '/ai-visibility/overview', keywords: ['ai vis'] },
  { id: 'ai-sources', label: 'Sources', path: 'ai-visibility/sources', match: '/ai-visibility/sources', keywords: ['citations'] },
  { id: 'ai-competitors', label: 'Competitors', path: 'ai-visibility/competitors', match: '/ai-visibility/competitors', keywords: ['rivals'] },
  { id: 'ai-prompts', label: 'Prompts', path: 'ai-visibility/prompts', match: '/ai-visibility/prompts', keywords: ['queries'] },
  { id: 'ai-fanout', label: 'Fanout Queries', path: 'ai-visibility/fanout-queries', match: '/ai-visibility/fanout-queries', keywords: ['fanout'] },
];

export const siteNavigation = {
  seo: SEO_NAV,
  tools: TOOLS_NAV,
  aiVisibility: AI_VISIBILITY_NAV,
} as const;

export function sitePath(slug: string, path: string): string {
  return `/sites/${slug}/${path}`;
}

export type ResolvedNavLink = SiteNavItem & { href: string };

export function resolveSiteNav(
  items: readonly SiteNavItem[],
  slug: string,
  hrefFn: (path: string) => string,
): ResolvedNavLink[] {
  return items.map((item) => ({
    ...item,
    href: hrefFn(sitePath(slug, item.path)),
  }));
}

/** Deep-link-only surfaces (not primary Tools nav). */
export const AUDIT_URL_PATH = 'audit-tool';
export const RANK_TRACKING_PATH = 'keyword-tracker';
