import { queryRows, queryOne } from '../db/query';
import { parseJsonish } from '../types/json';
import {
  classifyPage,
  countIssuesForPage,
  loadSiteAuditContext,
  type AuditRow,
} from './issues';
import type { CrawledPageRow, CrawledPagesReport, PageBucket } from './types';
import type { SiteAuditLimitInfo } from './pageLimit';

type DomainRow = { domain: string };

function parseStatusCode(fetchStatus: string | null): { code: number | null; label: string } {
  const st = (fetchStatus ?? '').toUpperCase();
  if (st === 'OK') return { code: 200, label: '200' };
  if (st.startsWith('REDIRECT_')) {
    const code = Number.parseInt(st.replace('REDIRECT_', ''), 10);
    const resolved = Number.isFinite(code) ? code : 301;
    return { code: resolved, label: String(resolved) };
  }
  if (st.startsWith('HTTP_')) {
    const code = Number.parseInt(st.replace('HTTP_', ''), 10);
    if (Number.isFinite(code)) return { code, label: String(code) };
    return { code: null, label: st };
  }
  if (st === 'ERROR') return { code: null, label: 'Error' };
  return { code: null, label: st || '—' };
}

function computeDepth(url: string): number {
  try {
    const u = new URL(url);
    return u.pathname.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}

const AI_BOT_COUNT = 4;

export async function buildCrawledPagesReport(
  slug: string,
  domainId: number,
  limitInfo: SiteAuditLimitInfo,
): Promise<CrawledPagesReport> {
  const meta = await queryOne<DomainRow>(
    'SELECT domain FROM domain WHERE "ID" = ? LIMIT 1',
    [domainId],
  );
  const domain = meta?.domain ?? slug;

  const rows = await queryRows<AuditRow & { last_audited_at: string | null; title: string | null }>(
    `SELECT url, title, score, fetch_status, signals_json, duration_ms, last_audited_at
     FROM page_audits WHERE domain_id = ? ORDER BY url`,
    [domainId],
  );

  const ctx = await loadSiteAuditContext(domain, rows);

  const distribution: Record<PageBucket, number> = {
    healthy: 0,
    broken: 0,
    haveIssues: 0,
    redirects: 0,
    blocked: 0,
  };

  const pages: CrawledPageRow[] = rows.map((row, idx) => {
    const bucket = classifyPage(row);
    distribution[bucket] += 1;
    const { code, label } = parseStatusCode(row.fetch_status);
    const issues = countIssuesForPage(row, ctx);
    const signals = parseJsonish<{ title?: string }>(row.signals_json) ?? {};

    return {
      id: String(idx),
      url: row.url,
      title: row.title ?? signals.title ?? null,
      score: row.score,
      statusCode: code,
      statusLabel: label,
      issueCount: issues.total,
      issueErrors: issues.errors,
      issueWarnings: issues.warnings,
      depth: computeDepth(row.url),
      bucket,
      blockedAiBots: 0,
      totalAiBots: AI_BOT_COUNT,
      discoveredAt: row.last_audited_at,
    };
  });

  return {
    pages,
    total: pages.length,
    distribution,
    pagesLimit: limitInfo.pagesLimit,
    atCrawlLimit: pages.length >= limitInfo.pagesLimit,
    planSlug: limitInfo.planSlug,
    planName: limitInfo.planName,
    canUpgradeCrawlLimit: limitInfo.canUpgradeForMore,
    upgradePlanSlug: limitInfo.upgradePlanSlug,
    upgradePlanName: limitInfo.upgradePlanName,
    upgradePagesLimit: limitInfo.upgradePagesLimit,
  };
}
