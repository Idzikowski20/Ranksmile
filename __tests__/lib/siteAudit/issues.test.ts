import {
  collectMalformedLinks,
  collectNoAnchorLinks,
  collectNofollowLinks,
  getMatchingRows,
  buildIssuesReport,
  type AuditRow,
} from '../../../lib/siteAudit/issues';
import type { SiteAuditContext } from '../../../lib/siteAudit/types';

function row(
  url: string,
  signals: Record<string, unknown>,
  overrides: Partial<AuditRow> = {},
): AuditRow {
  return {
    url,
    title: null,
    score: 80,
    fetch_status: 'OK',
    signals_json: JSON.stringify(signals),
    duration_ms: 100,
    ...overrides,
  };
}

const emptyCtx: SiteAuditContext = {
  domain: 'example.com',
  sitemapIssues: [],
  sitemapUrlsChecked: 0,
  permanentRedirects: [],
  redirectUrlsChecked: 0,
  hstsMissingSubdomains: [],
  incomingLinkCounts: {},
  external403Links: [],
};

describe('siteAudit issues', () => {
  it('detects low text-HTML ratio at 10%', () => {
    const rows = [row('https://example.com/a', { text_html_ratio: 0.08 })];
    const matched = getMatchingRows('low_text_ratio', rows, emptyCtx);
    expect(matched).toHaveLength(1);
  });

  it('detects title too long above 70 chars', () => {
    const rows = [row('https://example.com/a', { title_length: 71 })];
    expect(getMatchingRows('title_too_long', rows, emptyCtx)).toHaveLength(1);
  });

  it('detects missing meta description', () => {
    const rows = [row('https://example.com/a', { description_length: 0 })];
    expect(getMatchingRows('missing_meta_description', rows, emptyCtx)).toHaveLength(1);
  });

  it('detects duplicate h1 and title', () => {
    const rows = [row('https://example.com/a', { duplicate_h1_title: true })];
    expect(getMatchingRows('duplicate_h1_title', rows, emptyCtx)).toHaveLength(1);
  });

  it('detects missing h1', () => {
    const rows = [row('https://example.com/a', { h1_count: 0 })];
    expect(getMatchingRows('missing_h1', rows, emptyCtx)).toHaveLength(1);
  });

  it('detects multiple h1', () => {
    const rows = [row('https://example.com/a', { h1_count: 2 })];
    expect(getMatchingRows('multiple_h1', rows, emptyCtx)).toHaveLength(1);
  });

  it('counts malformed links not pages', () => {
    const rows = [
      row('https://example.com/a', {
        malformed_links: [{ href: 'http://bad url' }, { href: 'http://also bad' }],
      }),
    ];
    expect(collectMalformedLinks(rows)).toHaveLength(2);
    const report = buildIssuesReport(rows, emptyCtx);
    const issue = report.issues.find((i) => i.id === 'malformed_url_crawl');
    expect(issue?.count).toBe(2);
  });

  it('counts external nofollow links', () => {
    const rows = [
      row('https://example.com/a', {
        external_nofollow_links: [{ href: 'https://ext.com', anchor: 'x' }],
      }),
    ];
    expect(collectNofollowLinks(rows)).toHaveLength(1);
  });

  it('counts no-anchor links', () => {
    const rows = [
      row('https://example.com/a', {
        no_anchor_links: [{ href: 'https://example.com/b', anchor: '' }],
      }),
    ];
    expect(collectNoAnchorLinks(rows)).toHaveLength(1);
  });

  it('detects single incoming internal link via context', () => {
    const rows = [row('https://example.com/orphan', {})];
    const ctx: SiteAuditContext = {
      ...emptyCtx,
      incomingLinkCounts: { 'https://example.com/orphan': 1 },
    };
    expect(getMatchingRows('single_incoming_internal_link', rows, ctx)).toHaveLength(1);
  });

  it('buildIssuesReport only includes Semrush issue types with counts', () => {
    const rows = [
      row('https://example.com/a', { description_length: 0, h1_count: 0 }),
    ];
    const report = buildIssuesReport(rows, emptyCtx);
    const ids = report.issues.map((i) => i.id);
    expect(ids).toContain('missing_meta_description');
    expect(ids).toContain('missing_h1');
    expect(ids).not.toContain('http_404');
    expect(ids).not.toContain('thin_content');
  });
});
