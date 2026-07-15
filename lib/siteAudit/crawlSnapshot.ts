import { randomUUID } from 'crypto';
import db from '../../database/database';
import { queryOne, queryRows } from '../db/query';
import { parseJsonish } from '../types/json';
import {
  buildIssuesReport,
  collectMalformedLinks,
  collectNoAnchorLinks,
  collectNofollowLinks,
  getIssueRule,
  loadSiteAuditContext,
  siteHealthScore,
  type AuditRow,
} from './issues';
import { pagesWithSingleIncoming } from './incomingLinkGraph';
import type { PageAuditSignals } from './types';
import { normalizeForIncoming } from './redirectScan';
import type { IssueSeverity } from './types';

export type CrawlSnapshotMetrics = {
  pagesCrawled: number;
  siteHealth: number;
  totalIssues: number;
  totalErrors: number;
  totalWarnings: number;
  totalNotices: number;
  issueCounts: Record<string, number>;
  issueUrls: Record<string, string[]>;
};

export type CrawlSnapshotRow = {
  id: string;
  domain_id: number;
  crawled_at: string;
  metrics_json: string;
};

export type CrawlSnapshotListItem = {
  id: string;
  crawledAt: string;
  label: string;
};

function formatCrawlLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} (${time})`;
}

function sumCountsBySeverity(
  issueCounts: Record<string, number>,
  severityById: Record<string, IssueSeverity>,
  severity: IssueSeverity,
): number {
  let sum = 0;
  for (const [id, count] of Object.entries(issueCounts)) {
    if (severityById[id] === severity) sum += count;
  }
  return sum;
}

function collectIssueUrlKeys(
  issueId: string,
  rows: AuditRow[],
  ctx: Awaited<ReturnType<typeof loadSiteAuditContext>>,
): string[] {
  const rule = getIssueRule(issueId);
  if (!rule) return [];

  if (issueId === 'sitemap_incorrect_pages') {
    return ctx.sitemapIssues.map((item) => `${item.sitemapUrl}|${item.linkUrl}`);
  }
  if (issueId === 'malformed_url_crawl') {
    return collectMalformedLinks(rows).map((item) => `${item.pageUrl}|${item.malformedUrl}`);
  }
  if (issueId === 'permanent_redirect') {
    return ctx.permanentRedirects.map((item) => item.url);
  }
  if (issueId === 'external_nofollow') {
    return collectNofollowLinks(rows).map((item) => `${item.pageUrl}|${item.linkUrl}`);
  }
  if (issueId === 'no_anchor_text') {
    return collectNoAnchorLinks(rows).map((item) => `${item.pageUrl}|${item.linkUrl}`);
  }
  if (issueId === 'single_incoming_internal_link') {
    return pagesWithSingleIncoming(ctx.incomingLinkCounts);
  }
  if (issueId === 'hsts_missing') {
    return ctx.hstsMissingSubdomains.map((item) => item.subdomain);
  }
  if (issueId === 'external_link_403') {
    return ctx.external403Links.map((item) => `${item.pageUrl}|${item.externalUrl}`);
  }

  const keys: string[] = [];
  for (const row of rows) {
    const signals = parseJsonish<PageAuditSignals>(row.signals_json) ?? {};
    if (rule.match(row, signals, ctx)) {
      keys.push(row.url);
    }
  }
  return keys;
}

export async function buildCrawlSnapshotMetrics(
  domain: string,
  rows: AuditRow[],
): Promise<CrawlSnapshotMetrics> {
  const ctx = await loadSiteAuditContext(domain, rows);
  const report = buildIssuesReport(rows, ctx);
  const issueCounts: Record<string, number> = {};
  const severityById: Record<string, IssueSeverity> = {};
  const issueUrls: Record<string, string[]> = {};

  for (const issue of report.issues) {
    issueCounts[issue.id] = issue.count;
    severityById[issue.id] = issue.severity;
    issueUrls[issue.id] = collectIssueUrlKeys(issue.id, rows, ctx);
  }

  const totalIssues = Object.values(issueCounts).reduce((sum, n) => sum + n, 0);

  return {
    pagesCrawled: rows.length,
    siteHealth: siteHealthScore(rows, ctx),
    totalIssues,
    totalErrors: sumCountsBySeverity(issueCounts, severityById, 'error'),
    totalWarnings: sumCountsBySeverity(issueCounts, severityById, 'warning'),
    totalNotices: sumCountsBySeverity(issueCounts, severityById, 'notice'),
    issueCounts,
    issueUrls,
  };
}

export function parseCrawlSnapshotMetrics(raw: string | null): CrawlSnapshotMetrics | null {
  return parseJsonish<CrawlSnapshotMetrics>(raw);
}

export async function saveCrawlSnapshot(domainId: number, domainHint?: string): Promise<string | null> {
  const meta = domainHint
    ? null
    : await queryOne<{ domain: string }>(
        'SELECT domain FROM domain WHERE "ID" = ? LIMIT 1',
        [domainId],
      );
  const domain = domainHint || meta?.domain;
  if (!domain) return null;

  const rows = await queryRows<AuditRow>(
    `SELECT url, title, score, fetch_status, signals_json, duration_ms
     FROM page_audits WHERE domain_id = ? ORDER BY url`,
    [domainId],
  );
  if (!rows.length) return null;

  const metrics = await buildCrawlSnapshotMetrics(domain, rows);
  const id = randomUUID();
  const crawledAt = new Date().toISOString();

  await db.query(
    `INSERT INTO site_audit_crawl_snapshots (id, domain_id, crawled_at, metrics_json)
     VALUES (?, ?, ?, ?)`,
    { replacements: [id, domainId, crawledAt, JSON.stringify(metrics)] },
  );

  return id;
}

export async function listCrawlSnapshots(domainId: number): Promise<CrawlSnapshotListItem[]> {
  const rows = await queryRows<{ id: string; crawled_at: string }>(
    `SELECT id, crawled_at FROM site_audit_crawl_snapshots
     WHERE domain_id = ? ORDER BY crawled_at DESC`,
    [domainId],
  );
  return rows.map((row) => ({
    id: row.id,
    crawledAt: row.crawled_at,
    label: formatCrawlLabel(row.crawled_at),
  }));
}

export async function getCrawlSnapshot(
  snapshotId: string,
  domainId: number,
): Promise<{ id: string; crawledAt: string; label: string; metrics: CrawlSnapshotMetrics } | null> {
  const row = await queryOne<CrawlSnapshotRow>(
    `SELECT id, domain_id, crawled_at, metrics_json FROM site_audit_crawl_snapshots
     WHERE id = ? AND domain_id = ? LIMIT 1`,
    [snapshotId, domainId],
  );
  if (!row) return null;
  const metrics = parseCrawlSnapshotMetrics(row.metrics_json);
  if (!metrics) return null;
  return {
    id: row.id,
    crawledAt: row.crawled_at,
    label: formatCrawlLabel(row.crawled_at),
    metrics,
  };
}

/** Backfill a snapshot when crawl data exists but history was never recorded. */
export async function ensureCrawlSnapshot(domainId: number, domain: string): Promise<void> {
  const existing = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM site_audit_crawl_snapshots WHERE domain_id = ?`,
    [domainId],
  );
  if ((existing?.n ?? 0) > 0) return;
  await saveCrawlSnapshot(domainId, domain);
}

export { formatCrawlLabel };
