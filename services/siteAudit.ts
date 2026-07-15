import { useQuery } from 'react-query';
import type {
  CompareCrawlsReport,
  CrawledPagesReport,
  SiteAuditIssueDetailPayload,
  SiteAuditOverviewPayload,
} from '../lib/siteAudit/types';

async function fetchSiteAudit(slug: string): Promise<SiteAuditOverviewPayload> {
  const res = await fetch(`/api/domains/${encodeURIComponent(slug)}/site-audit`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Site audit failed (${res.status})`);
  }
  return res.json() as Promise<SiteAuditOverviewPayload>;
}

async function fetchIssueDetail(slug: string, issueId: string): Promise<SiteAuditIssueDetailPayload> {
  const res = await fetch(
    `/api/domains/${encodeURIComponent(slug)}/site-audit/issues/${encodeURIComponent(issueId)}`,
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Issue detail failed (${res.status})`);
  }
  return res.json() as Promise<SiteAuditIssueDetailPayload>;
}

async function fetchCrawledPages(slug: string): Promise<CrawledPagesReport> {
  const res = await fetch(`/api/domains/${encodeURIComponent(slug)}/site-audit/pages`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Crawled pages failed (${res.status})`);
  }
  return res.json() as Promise<CrawledPagesReport>;
}

export function useSiteAuditOverview(slug: string | undefined) {
  return useQuery(
    ['site-audit', slug],
    () => fetchSiteAudit(slug as string),
    { enabled: !!slug, staleTime: 60_000 },
  );
}

export function useSiteAuditIssueDetail(slug: string | undefined, issueId: string | undefined) {
  return useQuery(
    ['site-audit-issue', slug, issueId],
    () => fetchIssueDetail(slug as string, issueId as string),
    { enabled: !!slug && !!issueId, staleTime: 60_000 },
  );
}

async function fetchCompareCrawls(
  slug: string,
  olderId?: string,
  newerId?: string,
): Promise<CompareCrawlsReport> {
  const params = new URLSearchParams();
  if (olderId) params.set('older', olderId);
  if (newerId) params.set('newer', newerId);
  const qs = params.toString();
  const res = await fetch(
    `/api/domains/${encodeURIComponent(slug)}/site-audit/compare${qs ? `?${qs}` : ''}`,
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Compare crawls failed (${res.status})`);
  }
  return res.json() as Promise<CompareCrawlsReport>;
}

export function useSiteAuditCompareCrawls(
  slug: string | undefined,
  olderId?: string,
  newerId?: string,
) {
  return useQuery(
    ['site-audit-compare', slug, olderId, newerId],
    () => fetchCompareCrawls(slug as string, olderId, newerId),
    { enabled: !!slug, staleTime: 60_000 },
  );
}

export function useSiteAuditCrawledPages(slug: string | undefined) {
  return useQuery(
    ['site-audit-pages', slug],
    () => fetchCrawledPages(slug as string),
    { enabled: !!slug, staleTime: 60_000 },
  );
}
