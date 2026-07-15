import { queryRows, queryOne } from '../db/query';
import { parseJsonish } from '../types/json';
import {
  aiSearchHealthScore,
  buildIssuesReport,
  classifyPage,
  collectIssues,
  countBySeverity,
  loadSiteAuditContext,
  siteHealthScore,
  type AuditRow,
} from './issues';
import type { PageBucket, SiteAuditOverviewPayload, ThematicReport } from './types';
import type { SiteAuditLimitInfo } from './pageLimit';

const BENCHMARK_HEALTH = 92;

type DomainRow = { ID: number; domain: string };

function perfScore(rows: AuditRow[]): number {
  const durations = rows
    .filter((r) => (r.fetch_status ?? '').toUpperCase() === 'OK')
    .map((r) => r.duration_ms ?? 0)
    .filter((n) => n > 0);
  if (!durations.length) return 100;
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  if (avg <= 800) return 100;
  if (avg <= 1500) return 92;
  if (avg <= 2500) return 78;
  if (avg <= 4000) return 65;
  return 50;
}

function linkingScore(rows: AuditRow[]): number {
  const ok = rows.filter((r) => (r.fetch_status ?? '').toUpperCase() === 'OK');
  if (!ok.length) return 0;
  let sum = 0;
  for (const row of ok) {
    const s = parseJsonish<{ internal_links?: number }>(row.signals_json) ?? {};
    const links = s.internal_links ?? 0;
    if (links >= 8) sum += 100;
    else if (links >= 5) sum += 90;
    else if (links >= 3) sum += 78;
    else if (links >= 1) sum += 62;
    else sum += 40;
  }
  return Math.round(sum / ok.length);
}

function markupScore(rows: AuditRow[]): number {
  const ok = rows.filter((r) => (r.fetch_status ?? '').toUpperCase() === 'OK');
  if (!ok.length) return 0;
  let sum = 0;
  for (const row of ok) {
    const s = parseJsonish<{ heading_count?: number; title_length?: number }>(row.signals_json) ?? {};
    let page = 100;
    if ((s.title_length ?? 0) < 10) page -= 25;
    if ((s.heading_count ?? 0) < 2) page -= 20;
    else if ((s.heading_count ?? 0) < 5) page -= 8;
    sum += Math.max(0, page);
  }
  return Math.round(sum / ok.length);
}

function buildThematic(domain: string, rows: AuditRow[]): ThematicReport[] {
  const total = rows.length;
  const okCount = rows.filter((r) => (r.fetch_status ?? '').toUpperCase() === 'OK').length;
  const crawlPct = total ? Math.round((okCount / total) * 100) : 0;
  const httpsPct = total
    ? Math.round((rows.filter((r) => r.url.toLowerCase().startsWith('https://')).length / total) * 100)
    : 100;

  return [
    {
      id: 'robots',
      title: 'Robots.txt',
      score: null,
      deltaLabel: 'No changes',
      externalHref: `https://${domain}/robots.txt`,
      actionLabel: 'Open file',
    },
    {
      id: 'crawlability',
      title: 'Crawlability',
      score: crawlPct,
      deltaLabel: 'No changes',
      actionLabel: 'View details',
    },
    {
      id: 'https',
      title: 'HTTPS',
      score: httpsPct,
      deltaLabel: 'No changes',
      actionLabel: 'View details',
    },
    {
      id: 'international',
      title: 'International SEO',
      score: null,
      deltaLabel: '',
      notice: 'International SEO is not implemented on this site.',
      actionLabel: 'View details',
    },
    {
      id: 'web_vitals',
      title: 'Core Web Vitals',
      score: null,
      deltaLabel: '',
      notice: 'Run a full crawl to collect Core Web Vitals.',
      actionLabel: 'View more',
    },
    {
      id: 'performance',
      title: 'Site Performance',
      score: perfScore(rows),
      deltaLabel: 'No changes',
      actionLabel: 'View details',
    },
    {
      id: 'linking',
      title: 'Internal Linking',
      score: linkingScore(rows),
      deltaLabel: 'No changes',
      actionLabel: 'View details',
    },
    {
      id: 'markup',
      title: 'Markup',
      score: markupScore(rows),
      deltaLabel: 'No changes',
      actionLabel: 'View details',
    },
  ];
}

export async function buildSiteAuditOverview(
  slug: string,
  domainId: number,
  limitInfo: SiteAuditLimitInfo,
): Promise<SiteAuditOverviewPayload> {
  const meta = await queryOne<DomainRow & { domain: string }>(
    'SELECT "ID", domain FROM domain WHERE "ID" = ? LIMIT 1',
    [domainId],
  );
  const domain = meta?.domain ?? slug;

  const rows = await queryRows<AuditRow & { last_audited_at: string | null; title: string | null }>(
    `SELECT url, title, score, fetch_status, signals_json, duration_ms, last_audited_at
     FROM page_audits WHERE domain_id = ? ORDER BY url`,
    [domainId],
  );

  const job = await queryOne<{ status: string | null; updated_at: string | null }>(
    `SELECT status, updated_at FROM analysis_jobs WHERE id = ? LIMIT 1`,
    [`dsetup_${domainId}`],
  );

  const updatedAt = rows.reduce<string | null>((max, r) => {
    const t = r.last_audited_at;
    if (!t) return max;
    if (!max || t > max) return t;
    return max;
  }, job?.updated_at ?? null);

  const distribution: Record<PageBucket, number> = {
    healthy: 0,
    broken: 0,
    haveIssues: 0,
    redirects: 0,
    blocked: 0,
  };

  for (const row of rows) {
    const bucket = classifyPage(row);
    distribution[bucket] += 1;
  }

  const ctx = await loadSiteAuditContext(domain, rows);
  const issues = collectIssues(rows, ctx);
  const { errors, warnings } = countBySeverity(issues);
  const siteHealth = siteHealthScore(rows, ctx);
  const aiHealth = aiSearchHealthScore(rows);
  const aiIssues = issues.filter((i) => i.aiSearch).length;

  const aiNotice = aiHealth >= 90
    ? 'Website is better optimized for AI search engines'
    : aiHealth >= 70
      ? 'Some pages need optimization for AI search'
      : 'Improve structure and metadata for AI search visibility';

  return {
    domain,
    slug,
    updatedAt,
    device: 'desktop',
    jsRendering: false,
    pagesCrawled: rows.length,
    pagesLimit: limitInfo.pagesLimit,
    atCrawlLimit: rows.length >= limitInfo.pagesLimit,
    siteHealth,
    siteHealthDelta: null,
    benchmarkHealth: BENCHMARK_HEALTH,
    aiSearchHealth: aiHealth,
    aiSearchIssues: aiIssues,
    aiSearchNotice: aiNotice,
    crawledPages: {
      total: rows.length,
      delta: null,
      distribution,
    },
    trends: {
      errors,
      warnings,
      errorsDelta: null,
      warningsDelta: null,
    },
    topInsights: issues.slice(0, 5),
    issuesReport: buildIssuesReport(rows, ctx),
    thematicReports: buildThematic(domain, rows),
    hasData: rows.length > 0,
    setupJobStatus: job?.status ?? null,
    planSlug: limitInfo.planSlug,
    planName: limitInfo.planName,
    canUpgradeCrawlLimit: limitInfo.canUpgradeForMore,
    upgradePlanSlug: limitInfo.upgradePlanSlug,
    upgradePlanName: limitInfo.upgradePlanName,
    upgradePagesLimit: limitInfo.upgradePagesLimit,
  };
}
