import { parseJsonish } from '../types/json';
import {
  buildIssuesReport,
  buildLinkIssueInstances,
  buildMalformedInstances,
  buildSitemapInstances,
  collectIssueSummaries,
  collectMalformedLinks,
  collectNoAnchorLinks,
  collectNofollowLinks,
  getIssueRule,
  getMatchingRows,
  totalLinksScanned,
  type AuditRow,
} from './issues';
import { normalizeForIncoming } from './redirectScan';
import type {
  IssueDetailLayout,
  IssueInstance,
  PageAuditSignals,
  SiteAuditContext,
  SiteAuditIssueDetailPayload,
} from './types';

type AuditRowWithDate = AuditRow & { last_audited_at: string | null };

function signalsOf(row: AuditRow): PageAuditSignals {
  return parseJsonish<PageAuditSignals>(row.signals_json) ?? {};
}

function layoutForIssue(issueId: string): IssueDetailLayout {
  if (issueId === 'sitemap_incorrect_pages') return 'sitemap';
  if (issueId === 'malformed_url_crawl') return 'malformedUrl';
  if (issueId === 'low_text_ratio') return 'textRatio';
  if (issueId === 'permanent_redirect') return 'permanentRedirect';
  if (issueId === 'external_nofollow' || issueId === 'no_anchor_text') return 'linkIssue';
  if (issueId === 'single_incoming_internal_link') return 'incomingLinks';
  if (issueId === 'hsts_missing') return 'hsts';
  if (issueId === 'external_link_403') return 'external403';
  if (issueId === 'title_too_long') return 'titleLength';
  return 'default';
}

function buildInstances(
  issueId: string,
  rows: AuditRowWithDate[],
  ctx: SiteAuditContext | null,
  updatedAt: string | null,
): IssueInstance[] {
  if (issueId === 'sitemap_incorrect_pages') {
    return buildSitemapInstances(ctx?.sitemapIssues ?? [], updatedAt);
  }

  if (issueId === 'malformed_url_crawl') {
    return buildMalformedInstances(collectMalformedLinks(rows), updatedAt);
  }

  if (issueId === 'permanent_redirect') {
    return (ctx?.permanentRedirects ?? []).map((item, idx) => ({
      id: `redirect_${idx}_${item.url}`,
      url: item.url,
      secondaryUrl: item.target,
      issueType: String(item.statusCode),
      discoveredAt: updatedAt,
      isNew: true,
      score: null,
      fetchStatus: 'REDIRECT_301',
    }));
  }

  if (issueId === 'external_nofollow') {
    return buildLinkIssueInstances(collectNofollowLinks(rows), 'nofollow', updatedAt);
  }

  if (issueId === 'no_anchor_text') {
    return buildLinkIssueInstances(collectNoAnchorLinks(rows), 'noanchor', updatedAt);
  }

  if (issueId === 'single_incoming_internal_link' && ctx) {
    const urls = Object.entries(ctx.incomingLinkCounts)
      .filter(([, n]) => n === 1)
      .map(([url]) => url);
    return urls.map((url, idx) => {
      const row = rows.find((r) => normalizeForIncoming(r.url) === url);
      return {
        id: `incoming_${idx}_${url}`,
        url,
        title: row?.title ?? undefined,
        incomingCount: 1,
        discoveredAt: row?.last_audited_at ?? updatedAt,
        isNew: true,
        score: row?.score ?? null,
        fetchStatus: row?.fetch_status ?? null,
      };
    });
  }

  if (issueId === 'hsts_missing') {
    return (ctx?.hstsMissingSubdomains ?? []).map((item, idx) => ({
      id: `hsts_${idx}_${item.subdomain}`,
      url: `https://${item.subdomain}/`,
      subdomain: item.subdomain,
      discoveredAt: updatedAt,
      isNew: true,
      score: null,
      fetchStatus: null,
    }));
  }

  if (issueId === 'external_link_403') {
    return (ctx?.external403Links ?? []).map((item, idx) => ({
      id: `ext403_${idx}_${item.externalUrl}`,
      url: item.pageUrl,
      secondaryUrl: item.externalUrl,
      discoveredAt: updatedAt,
      isNew: true,
      score: null,
      fetchStatus: 'HTTP_403',
    }));
  }

  const matched = getMatchingRows(issueId, rows, ctx) as AuditRowWithDate[];

  return matched.map((row, idx) => {
    const s = signalsOf(row);
    return {
      id: `${issueId}_${idx}_${row.url}`,
      url: row.url,
      title: row.title ?? s.title ?? undefined,
      ratio: issueId === 'low_text_ratio' ? s.text_html_ratio : undefined,
      titleLength: issueId === 'title_too_long' ? s.title_length : undefined,
      discoveredAt: row.last_audited_at ?? updatedAt,
      isNew: true,
      score: row.score,
      fetchStatus: row.fetch_status,
    };
  });
}

function countSuccessful(
  issueId: string,
  rows: AuditRowWithDate[],
  failed: number,
  ctx: SiteAuditContext | null,
): number {
  if (issueId === 'sitemap_incorrect_pages') {
    const checked = ctx?.sitemapUrlsChecked ?? failed;
    return Math.max(0, checked - failed);
  }
  if (issueId === 'malformed_url_crawl') {
    const scanned = totalLinksScanned(rows);
    return Math.max(0, scanned - failed);
  }
  if (issueId === 'permanent_redirect') {
    const checked = ctx?.redirectUrlsChecked ?? rows.length;
    return Math.max(0, checked - failed);
  }
  if (issueId === 'external_nofollow' || issueId === 'no_anchor_text') {
    const scanned = totalLinksScanned(rows);
    return Math.max(0, scanned - failed);
  }
  if (issueId === 'low_text_ratio' || issueId === 'title_too_long'
    || issueId === 'missing_meta_description' || issueId === 'duplicate_h1_title'
    || issueId === 'missing_h1' || issueId === 'multiple_h1'
    || issueId === 'content_not_optimized' || issueId === 'single_incoming_internal_link') {
    const okRows = rows.filter((r) => (r.fetch_status ?? '').toUpperCase() === 'OK');
    return Math.max(0, okRows.length - failed);
  }
  if (issueId === 'hsts_missing') {
    const total = (ctx?.hstsMissingSubdomains.length ?? 0) + failed;
    return Math.max(0, total - failed);
  }
  if (issueId === 'external_link_403') {
    const probed = Math.min(80, totalLinksScanned(rows));
    return Math.max(0, probed - failed);
  }
  return Math.max(0, rows.length - failed);
}

export function buildIssueDetail(
  issueId: string,
  rows: AuditRowWithDate[],
  updatedAt: string | null,
  ctx: SiteAuditContext | null = null,
): SiteAuditIssueDetailPayload | null {
  const rule = getIssueRule(issueId);
  if (!rule) return null;

  const summaries = collectIssueSummaries(rows, ctx);
  const issue = summaries.find((i) => i.id === issueId);
  if (!issue) return null;

  const instances = buildInstances(issueId, rows, ctx, updatedAt);
  const failed = instances.length;
  const successful = countSuccessful(issueId, rows, failed, ctx);

  return {
    issue,
    failed,
    successful,
    instances,
    layout: layoutForIssue(issueId),
    updatedAt,
  };
}

export { buildIssuesReport };
