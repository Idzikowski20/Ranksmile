import { getIssueRule } from './issues';
import {
  ensureCrawlSnapshot,
  getCrawlSnapshot,
  listCrawlSnapshots,
  type CrawlSnapshotMetrics,
} from './crawlSnapshot';
import type { CompareCrawlsReport, CompareCrawlsRow, CrawlSnapshotOption } from './types';

const GENERAL_ROWS: Array<{
  id: string;
  label: string;
  pick: (m: CrawlSnapshotMetrics) => number;
  showDiff: boolean;
}> = [
  { id: 'pages_crawled', label: 'Pages crawled', pick: (m) => m.pagesCrawled, showDiff: false },
  { id: 'overall_score', label: 'Site Health', pick: (m) => m.siteHealth, showDiff: false },
  { id: 'total_issues', label: 'Total issues', pick: (m) => m.totalIssues, showDiff: true },
  { id: 'total_errors', label: 'Total errors', pick: (m) => m.totalErrors, showDiff: true },
  { id: 'total_warnings', label: 'Total warnings', pick: (m) => m.totalWarnings, showDiff: true },
  { id: 'total_notices', label: 'Total notices', pick: (m) => m.totalNotices, showDiff: true },
];

const SEVERITY_SECTIONS: Array<{ id: string; label: string; severity: 'error' | 'warning' | 'notice' }> = [
  { id: 'errors_issues', label: 'Errors', severity: 'error' },
  { id: 'warnings_issues', label: 'Warnings', severity: 'warning' },
  { id: 'notices_issues', label: 'Notices', severity: 'notice' },
];

function diffIssueUrls(
  older: CrawlSnapshotMetrics,
  newer: CrawlSnapshotMetrics,
  issueId: string,
): { fixed: number; newCount: number } {
  const olderSet = new Set(older.issueUrls[issueId] ?? []);
  const newerSet = new Set(newer.issueUrls[issueId] ?? []);
  let fixed = 0;
  let newCount = 0;
  for (const key of olderSet) {
    if (!newerSet.has(key)) fixed += 1;
  }
  for (const key of newerSet) {
    if (!olderSet.has(key)) newCount += 1;
  }
  return { fixed, newCount };
}

function diffCountMetrics(olderVal: number, newerVal: number): { fixed: number | null; newCount: number | null } {
  if (olderVal === newerVal) return { fixed: null, newCount: null };
  const fixed = Math.max(0, olderVal - newerVal);
  const newCount = Math.max(0, newerVal - olderVal);
  return {
    fixed: fixed > 0 ? fixed : null,
    newCount: newCount > 0 ? newCount : null,
  };
}

function buildRows(
  older: CrawlSnapshotMetrics,
  newer: CrawlSnapshotMetrics,
): CompareCrawlsRow[] {
  const rows: CompareCrawlsRow[] = [];

  rows.push({
    id: 'general_header',
    kind: 'section',
    label: 'General',
    section: 'general',
  });

  for (const item of GENERAL_ROWS) {
    const olderVal = item.pick(older);
    const newerVal = item.pick(newer);
    const diff = item.showDiff
      ? diffCountMetrics(olderVal, newerVal)
      : { fixed: null, newCount: null };
    rows.push({
      id: item.id,
      kind: 'general',
      label: item.label,
      section: 'general',
      olderValue: olderVal,
      newerValue: newerVal,
      fixed: diff.fixed,
      newCount: diff.newCount,
    });
  }

  for (const section of SEVERITY_SECTIONS) {
    rows.push({
      id: section.id,
      kind: 'section',
      label: section.label,
      section: section.severity === 'error' ? 'errors' : section.severity === 'warning' ? 'warnings' : 'notices',
      severity: section.severity,
    });

    const rules = [
      { id: 'sitemap_incorrect_pages', severity: 'error' as const },
      { id: 'malformed_url_crawl', severity: 'error' as const },
      { id: 'low_text_ratio', severity: 'warning' as const },
      { id: 'title_too_long', severity: 'warning' as const },
      { id: 'missing_meta_description', severity: 'warning' as const },
      { id: 'duplicate_h1_title', severity: 'warning' as const },
      { id: 'missing_h1', severity: 'warning' as const },
      { id: 'permanent_redirect', severity: 'notice' as const },
      { id: 'external_nofollow', severity: 'notice' as const },
      { id: 'no_anchor_text', severity: 'notice' as const },
      { id: 'single_incoming_internal_link', severity: 'notice' as const },
      { id: 'content_not_optimized', severity: 'notice' as const },
      { id: 'multiple_h1', severity: 'notice' as const },
      { id: 'hsts_missing', severity: 'notice' as const },
      { id: 'external_link_403', severity: 'notice' as const },
    ].filter((r) => r.severity === section.severity);

    for (const rule of rules) {
      const issueRule = getIssueRule(rule.id);
      const olderVal = older.issueCounts[rule.id] ?? 0;
      const newerVal = newer.issueCounts[rule.id] ?? 0;
      const urlDiff = diffIssueUrls(older, newer, rule.id);
      const diff = (olderVal === newerVal && urlDiff.fixed === 0 && urlDiff.newCount === 0)
        ? { fixed: null, newCount: null }
        : {
            fixed: urlDiff.fixed > 0 ? urlDiff.fixed : null,
            newCount: urlDiff.newCount > 0 ? urlDiff.newCount : null,
          };
      rows.push({
        id: rule.id,
        kind: 'issue',
        label: issueRule?.title ?? rule.id,
        section: section.severity === 'error' ? 'errors' : section.severity === 'warning' ? 'warnings' : 'notices',
        severity: section.severity,
        issueId: rule.id,
        olderValue: olderVal,
        newerValue: newerVal,
        fixed: diff.fixed,
        newCount: diff.newCount,
      });
    }
  }

  return rows;
}

export async function buildCompareCrawlsReport(
  domainId: number,
  domain: string,
  olderId?: string,
  newerId?: string,
): Promise<CompareCrawlsReport> {
  await ensureCrawlSnapshot(domainId, domain);
  const crawls = await listCrawlSnapshots(domainId);
  const options: CrawlSnapshotOption[] = crawls.map((c) => ({
    id: c.id,
    label: c.label,
    crawledAt: c.crawledAt,
  }));

  if (!options.length) {
    return {
      crawls: [],
      olderCrawlId: null,
      newerCrawlId: null,
      rows: [],
      hasData: false,
    };
  }

  const resolvedNewerId = newerId && options.some((c) => c.id === newerId)
    ? newerId
    : options[0].id;
  const resolvedOlderId = olderId && options.some((c) => c.id === olderId)
    ? olderId
    : (options.find((c) => c.id !== resolvedNewerId)?.id ?? resolvedNewerId);

  const newerSnap = await getCrawlSnapshot(resolvedNewerId, domainId);
  const olderSnap = await getCrawlSnapshot(resolvedOlderId, domainId);

  if (!newerSnap || !olderSnap) {
    return {
      crawls: options,
      olderCrawlId: resolvedOlderId,
      newerCrawlId: resolvedNewerId,
      rows: [],
      hasData: false,
    };
  }

  return {
    crawls: options,
    olderCrawlId: resolvedOlderId,
    newerCrawlId: resolvedNewerId,
    rows: buildRows(olderSnap.metrics, newerSnap.metrics),
    hasData: true,
  };
}
