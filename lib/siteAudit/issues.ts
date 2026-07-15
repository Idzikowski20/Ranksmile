import { parseJsonish } from '../types/json';
import { getCatalogEntry, formatIssueTitle, formatIssueLinkText } from './issueCatalog';
import { probeExternal403Links } from './externalLinkProbe';
import { checkHstsMissing } from './hstsCheck';
import { buildIncomingLinkCounts, pagesWithSingleIncoming } from './incomingLinkGraph';
import {
  collectPermanentRedirects,
  countRedirectUrlsChecked,
  normalizeForIncoming,
} from './redirectScan';
import { validateSitemapIssues } from './sitemapValidation';
import type {
  IssueCategory,
  IssueInstance,
  IssueSeverity,
  LinkIssueInstance,
  MalformedLinkInstance,
  PageAuditSignals,
  PageIssueCounts,
  SiteAuditContext,
  SiteAuditIssue,
  SiteAuditIssueSummary,
  SiteAuditIssuesReport,
  SitemapIssueInstance,
} from './types';

export type AuditRow = {
  url: string;
  title?: string | null;
  score: number | null;
  fetch_status: string | null;
  signals_json: string | null;
  duration_ms: number | null;
};

const TEXT_HTML_RATIO_MAX = 0.10;
const TITLE_MAX_LEN = 70;
const HEALTHY_SCORE = 70;

const SITE_ISSUE_IDS = new Set([
  'sitemap_incorrect_pages',
  'malformed_url_crawl',
  'permanent_redirect',
  'external_nofollow',
  'no_anchor_text',
  'hsts_missing',
  'external_link_403',
]);

function signalsOf(row: AuditRow): PageAuditSignals {
  return parseJsonish<PageAuditSignals>(row.signals_json) ?? {};
}

function isOk(row: AuditRow): boolean {
  return (row.fetch_status ?? '').toUpperCase() === 'OK';
}

function isPermanentRedirect(row: AuditRow): boolean {
  const st = (row.fetch_status ?? '').toUpperCase();
  if (st === 'REDIRECT_301') return true;
  if (!st.startsWith('REDIRECT_')) return false;
  const code = signalsOf(row).redirect_status;
  return code === 301 || code === 308;
}

type IssueRule = {
  id: string;
  title: string;
  severity: IssueSeverity;
  aiSearch?: boolean;
  categories: IssueCategory[];
  match: (row: AuditRow, s: PageAuditSignals, ctx: SiteAuditContext | null) => boolean;
};

const RULES: IssueRule[] = [
  {
    id: 'sitemap_incorrect_pages',
    title: 'Incorrect pages in sitemap.xml',
    severity: 'error',
    categories: ['crawlability'],
    match: () => false,
  },
  {
    id: 'malformed_url_crawl',
    title: "Links couldn't be crawled (incorrect URL format)",
    severity: 'error',
    categories: ['links', 'crawlability'],
    match: (_row, s) => (s.malformed_links?.length ?? 0) > 0,
  },
  {
    id: 'low_text_ratio',
    title: 'Low text to HTML ratio',
    severity: 'warning',
    categories: ['content', 'indexability'],
    match: (row, s) => isOk(row) && (s.text_html_ratio ?? 1) <= TEXT_HTML_RATIO_MAX,
  },
  {
    id: 'title_too_long',
    title: 'Title tag too long',
    severity: 'warning',
    categories: ['meta_tags', 'indexability'],
    match: (row, s) => isOk(row) && (s.title_length ?? 0) > TITLE_MAX_LEN,
  },
  {
    id: 'missing_meta_description',
    title: 'Missing meta description',
    severity: 'warning',
    categories: ['meta_tags', 'indexability'],
    match: (row, s) => isOk(row) && (s.description_length ?? 0) < 1,
  },
  {
    id: 'duplicate_h1_title',
    title: 'Duplicate H1 and title',
    severity: 'warning',
    categories: ['meta_tags', 'content'],
    match: (row, s) => isOk(row) && Boolean(s.duplicate_h1_title),
  },
  {
    id: 'missing_h1',
    title: 'Missing h1 heading',
    severity: 'warning',
    categories: ['meta_tags', 'content'],
    match: (row, s) => isOk(row) && (s.h1_count ?? 0) < 1,
  },
  {
    id: 'permanent_redirect',
    title: 'Permanent redirect',
    severity: 'notice',
    categories: ['crawlability', 'links'],
    match: (row) => isPermanentRedirect(row),
  },
  {
    id: 'external_nofollow',
    title: 'External nofollow links',
    severity: 'notice',
    categories: ['links'],
    match: (_row, s) => (s.external_nofollow_links?.length ?? 0) > 0,
  },
  {
    id: 'no_anchor_text',
    title: 'Links with no anchor text',
    severity: 'notice',
    categories: ['links'],
    match: (_row, s) => (s.no_anchor_links?.length ?? 0) > 0,
  },
  {
    id: 'single_incoming_internal_link',
    title: 'Single incoming internal link',
    severity: 'notice',
    categories: ['links', 'crawlability'],
    match: (row, _s, ctx) => {
      if (!isOk(row) || !ctx) return false;
      const key = normalizeForIncoming(row.url);
      return (ctx.incomingLinkCounts[key] ?? 0) === 1;
    },
  },
  {
    id: 'content_not_optimized',
    title: 'Content not optimized',
    severity: 'notice',
    aiSearch: true,
    categories: ['ai_search', 'content'],
    match: (row, s) => {
      if (!isOk(row)) return false;
      const scoreLow = (row.score ?? 0) < HEALTHY_SCORE && (row.score ?? 0) > 0;
      const structureIssues = Boolean(s.heading_hierarchy_issues) && (s.long_paragraphs ?? 0) > 0;
      return scoreLow || structureIssues;
    },
  },
  {
    id: 'multiple_h1',
    title: 'Multiple H1 tags',
    severity: 'notice',
    categories: ['meta_tags', 'content'],
    match: (row, s) => isOk(row) && (s.h1_count ?? 0) > 1,
  },
  {
    id: 'hsts_missing',
    title: 'HSTS missing',
    severity: 'notice',
    categories: ['crawlability'],
    match: () => false,
  },
  {
    id: 'external_link_403',
    title: 'External link 403',
    severity: 'notice',
    categories: ['links', 'http_status'],
    match: () => false,
  },
];

export function getIssueRule(issueId: string): IssueRule | undefined {
  return RULES.find((r) => r.id === issueId);
}

export function getMatchingRows(
  issueId: string,
  rows: AuditRow[],
  ctx: SiteAuditContext | null = null,
): AuditRow[] {
  const rule = getIssueRule(issueId);
  if (!rule || SITE_ISSUE_IDS.has(issueId)) return [];
  return rows.filter((row) => rule.match(row, signalsOf(row), ctx));
}

export function collectMalformedLinks(rows: AuditRow[]): MalformedLinkInstance[] {
  const out: MalformedLinkInstance[] = [];
  for (const row of rows) {
    const s = signalsOf(row);
    const pageTitle = row.title ?? s.title ?? '';
    for (const link of s.malformed_links ?? []) {
      out.push({
        pageUrl: row.url,
        pageTitle,
        malformedUrl: link.href,
      });
    }
  }
  return out;
}

export function collectNofollowLinks(rows: AuditRow[]): LinkIssueInstance[] {
  const out: LinkIssueInstance[] = [];
  for (const row of rows) {
    const s = signalsOf(row);
    const pageTitle = row.title ?? s.title ?? '';
    for (const link of s.external_nofollow_links ?? []) {
      out.push({
        pageUrl: row.url,
        pageTitle,
        linkUrl: link.href,
        anchor: link.anchor,
      });
    }
  }
  return out;
}

export function collectNoAnchorLinks(rows: AuditRow[]): LinkIssueInstance[] {
  const out: LinkIssueInstance[] = [];
  for (const row of rows) {
    const s = signalsOf(row);
    const pageTitle = row.title ?? s.title ?? '';
    for (const link of s.no_anchor_links ?? []) {
      out.push({
        pageUrl: row.url,
        pageTitle,
        linkUrl: link.href,
        anchor: link.anchor,
      });
    }
  }
  return out;
}

export async function loadSiteAuditContext(
  domain: string,
  rows: AuditRow[] = [],
): Promise<SiteAuditContext> {
  const [sitemap, external403Links, hstsMissingSubdomains] = await Promise.all([
    validateSitemapIssues(domain),
    probeExternal403Links(domain, rows),
    checkHstsMissing(domain, rows.map((r) => r.url)),
  ]);

  const incomingLinkCounts = buildIncomingLinkCounts(rows);
  const permanentRedirects = collectPermanentRedirects(rows);

  return {
    domain,
    sitemapIssues: sitemap.issues,
    sitemapUrlsChecked: sitemap.entriesChecked,
    permanentRedirects,
    redirectUrlsChecked: countRedirectUrlsChecked(rows),
    hstsMissingSubdomains,
    incomingLinkCounts,
    external403Links,
  };
}

function issueCountForRule(
  rule: IssueRule,
  rows: AuditRow[],
  ctx: SiteAuditContext | null,
): number {
  if (rule.id === 'sitemap_incorrect_pages') {
    return ctx?.sitemapIssues.length ?? 0;
  }
  if (rule.id === 'malformed_url_crawl') {
    return collectMalformedLinks(rows).length;
  }
  if (rule.id === 'permanent_redirect') {
    return ctx?.permanentRedirects.length ?? 0;
  }
  if (rule.id === 'external_nofollow') {
    return collectNofollowLinks(rows).length;
  }
  if (rule.id === 'no_anchor_text') {
    return collectNoAnchorLinks(rows).length;
  }
  if (rule.id === 'single_incoming_internal_link') {
    if (!ctx) return 0;
    return pagesWithSingleIncoming(ctx.incomingLinkCounts).length;
  }
  if (rule.id === 'hsts_missing') {
    return ctx?.hstsMissingSubdomains.length ?? 0;
  }
  if (rule.id === 'external_link_403') {
    return ctx?.external403Links.length ?? 0;
  }
  let n = 0;
  for (const row of rows) {
    if (rule.match(row, signalsOf(row), ctx)) n += 1;
  }
  return n;
}


function pageHasExternal403(row: AuditRow, ctx: SiteAuditContext | null): boolean {
  if (!ctx) return false;
  return ctx.external403Links.some((item) => item.pageUrl === row.url);
}

function hasHttpError(row: AuditRow): boolean {
  const st = (row.fetch_status ?? '').toUpperCase();
  if (st === 'OK' || st.startsWith('REDIRECT_')) return false;
  return true;
}

export function countIssuesForPage(
  row: AuditRow,
  ctx: SiteAuditContext | null,
): PageIssueCounts {
  let errors = 0;
  let warnings = 0;
  let notices = 0;
  const s = signalsOf(row);

  for (const rule of RULES) {
    if (rule.id === 'sitemap_incorrect_pages' || rule.id === 'hsts_missing') continue;
    if (rule.id === 'external_link_403') {
      if (pageHasExternal403(row, ctx)) notices += 1;
      continue;
    }
    if (rule.match(row, s, ctx)) {
      if (rule.severity === 'error') errors += 1;
      else if (rule.severity === 'warning') warnings += 1;
      else notices += 1;
    }
  }

  if (hasHttpError(row) && errors + warnings + notices === 0) {
    errors += 1;
  }

  return {
    total: errors + warnings + notices,
    errors,
    warnings,
    notices,
  };
}

export function classifyPage(row: AuditRow): 'healthy' | 'broken' | 'haveIssues' | 'redirects' | 'blocked' {
  const st = (row.fetch_status ?? '').toUpperCase();
  if (st.startsWith('REDIRECT_')) return 'redirects';
  if (!isOk(row)) return 'broken';
  const score = row.score ?? 0;
  if (score >= HEALTHY_SCORE) return 'healthy';
  return 'haveIssues';
}

function buildSummaries(
  rows: AuditRow[],
  ctx: SiteAuditContext | null,
): SiteAuditIssueSummary[] {
  const severityOrder: Record<IssueSeverity, number> = { error: 0, warning: 1, notice: 2 };
  const summaries: SiteAuditIssueSummary[] = [];

  for (const rule of RULES) {
    const n = issueCountForRule(rule, rows, ctx);
    if (n <= 0) continue;
    const catalog = getCatalogEntry(rule.id);
    const title = catalog ? formatIssueTitle(catalog, n) : rule.title;
    const linkText = catalog ? formatIssueLinkText(catalog, n) : `${n}`;
    const titleSuffix = catalog ? catalog.suffix : rule.title;
    summaries.push({
      id: rule.id,
      title,
      linkText,
      titleSuffix,
      severity: rule.severity,
      count: n,
      newCount: n,
      categories: catalog?.categories ?? rule.categories,
      aiSearch: rule.aiSearch,
      isNew: catalog?.isNew,
    });
  }

  return summaries.sort((a, b) => {
    const sd = severityOrder[a.severity] - severityOrder[b.severity];
    if (sd !== 0) return sd;
    return b.count - a.count;
  });
}

export function collectIssues(rows: AuditRow[], ctx: SiteAuditContext | null = null): SiteAuditIssue[] {
  return buildSummaries(rows, ctx).map((i) => ({
    id: i.id,
    title: i.title,
    severity: i.severity,
    count: i.count,
    aiSearch: i.aiSearch,
  }));
}

export function collectIssueSummaries(
  rows: AuditRow[],
  ctx: SiteAuditContext | null = null,
): SiteAuditIssueSummary[] {
  return buildSummaries(rows, ctx);
}

export function buildIssuesReport(
  rows: AuditRow[],
  ctx: SiteAuditContext | null = null,
): SiteAuditIssuesReport {
  const issues = collectIssueSummaries(rows, ctx);
  const categoryCounts: Record<IssueCategory, number> = {
    all: issues.length,
    ai_search: 0,
    crawlability: 0,
    content: 0,
    meta_tags: 0,
    links: 0,
    indexability: 0,
    http_status: 0,
  };

  for (const issue of issues) {
    for (const cat of issue.categories) {
      if (cat !== 'all') categoryCounts[cat] += 1;
    }
  }

  let errors = 0;
  let warnings = 0;
  let notices = 0;
  for (const issue of issues) {
    if (issue.severity === 'error') errors += 1;
    else if (issue.severity === 'warning') warnings += 1;
    else notices += 1;
  }

  return {
    issues,
    categoryCounts,
    severityCounts: {
      all: issues.length,
      errors,
      warnings,
      notices,
    },
  };
}

export function countBySeverity(issues: SiteAuditIssue[]): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const i of issues) {
    if (i.severity === 'error') errors += i.count;
    else if (i.severity === 'warning') warnings += i.count;
  }
  return { errors, warnings };
}

export function siteHealthScore(rows: AuditRow[], ctx: SiteAuditContext | null = null): number {
  const okCount = rows.filter(isOk).length;
  if (!rows.length) return 0;
  if (!okCount && rows.every((r) => !isOk(r) && !isPermanentRedirect(r))) return 0;

  const issues = collectIssues(rows, ctx).filter((i) => i.severity !== 'notice');
  if (!issues.length) return 100;

  const total = rows.length;
  let penalty = 0;

  for (const issue of issues) {
    const coverage = issue.count / total;
    const base = issue.severity === 'error' ? 12 : 4;
    penalty += base + coverage * 18;
  }

  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function averageOkScore(rows: AuditRow[]): number {
  const ok = rows.filter(isOk);
  if (!ok.length) return 0;
  const sum = ok.reduce((acc, r) => acc + (r.score ?? 0), 0);
  return Math.round(sum / ok.length);
}

export function aiSearchHealthScore(rows: AuditRow[]): number {
  const ok = rows.filter(isOk);
  if (!ok.length) return 0;
  let sum = 0;
  for (const row of ok) {
    const s = signalsOf(row);
    let page = 100;
    if ((s.description_length ?? 0) < 1) page -= 15;
    if ((s.heading_count ?? 0) < 3) page -= 10;
    if ((s.word_count ?? 0) < 300) page -= 12;
    if ((row.score ?? 0) < HEALTHY_SCORE) page -= 15;
    if (s.heading_hierarchy_issues) page -= 10;
    if ((s.long_paragraphs ?? 0) > 2) page -= 8;
    sum += Math.max(0, Math.min(100, page));
  }
  return Math.round(sum / ok.length);
}

export function buildSitemapInstances(
  issues: SitemapIssueInstance[],
  updatedAt: string | null,
): IssueInstance[] {
  return issues.map((item, idx) => ({
    id: `sitemap_${idx}_${item.linkUrl}`,
    url: item.linkUrl,
    sitemapUrl: item.sitemapUrl,
    issueType: item.issueType,
    discoveredAt: updatedAt,
    isNew: true,
    score: null,
    fetchStatus: null,
  }));
}

export function buildMalformedInstances(
  links: MalformedLinkInstance[],
  updatedAt: string | null,
): IssueInstance[] {
  return links.map((item, idx) => ({
    id: `malformed_${idx}_${item.malformedUrl}`,
    url: item.pageUrl,
    title: item.pageTitle,
    secondaryUrl: item.malformedUrl,
    discoveredAt: updatedAt,
    isNew: true,
    score: null,
    fetchStatus: null,
  }));
}

export function buildLinkIssueInstances(
  links: LinkIssueInstance[],
  prefix: string,
  updatedAt: string | null,
): IssueInstance[] {
  return links.map((item, idx) => ({
    id: `${prefix}_${idx}_${item.linkUrl}`,
    url: item.pageUrl,
    title: item.pageTitle,
    secondaryUrl: item.linkUrl,
    anchor: item.anchor,
    discoveredAt: updatedAt,
    isNew: true,
    score: null,
    fetchStatus: null,
  }));
}

export function totalLinksScanned(rows: AuditRow[]): number {
  let total = 0;
  for (const row of rows) {
    const s = signalsOf(row);
    total += s.link_count ?? 0;
  }
  return total;
}
