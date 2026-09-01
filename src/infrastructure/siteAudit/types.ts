export type SiteAuditTab =
  | 'overview'
  | 'issues'
  | 'pagereport'
  | 'compare'
  | 'history'
  | 'js-impact';

export type IssueSeverity = 'error' | 'warning' | 'notice';

export type PageBucket = 'healthy' | 'broken' | 'haveIssues' | 'redirects' | 'blocked';

export type LinkSignal = { href: string; anchor?: string };

export type PageAuditSignals = {
  word_count?: number;
  title_length?: number;
  description_length?: number;
  heading_count?: number;
  paragraph_count?: number;
  image_alt_ratio?: number;
  internal_links?: number;
  text_html_ratio?: number;
  link_count?: number;
  title?: string;
  malformed_links?: LinkSignal[];
  h1_count?: number;
  h1_text?: string;
  h1_texts?: string[];
  duplicate_h1_title?: boolean;
  outbound_internal_hrefs?: string[];
  external_nofollow_links?: LinkSignal[];
  no_anchor_links?: LinkSignal[];
  external_links?: LinkSignal[];
  heading_hierarchy_issues?: boolean;
  long_paragraphs?: number;
  redirect_target?: string;
  redirect_status?: number;
};

export type PermanentRedirectInstance = {
  url: string;
  target: string;
  statusCode: number;
};

export type External403Instance = {
  pageUrl: string;
  externalUrl: string;
};

export type LinkIssueInstance = {
  pageUrl: string;
  pageTitle: string;
  linkUrl: string;
  anchor?: string;
};

export type HstsMissingInstance = {
  subdomain: string;
};

export type SitemapIssueInstance = {
  sitemapUrl: string;
  linkUrl: string;
  issueType: string;
};

export type MalformedLinkInstance = {
  pageUrl: string;
  pageTitle: string;
  malformedUrl: string;
};

export type SiteAuditContext = {
  domain: string;
  sitemapIssues: SitemapIssueInstance[];
  sitemapUrlsChecked: number;
  permanentRedirects: PermanentRedirectInstance[];
  redirectUrlsChecked: number;
  hstsMissingSubdomains: HstsMissingInstance[];
  incomingLinkCounts: Record<string, number>;
  external403Links: External403Instance[];
};

export type IssueCategory =
  | 'all'
  | 'ai_search'
  | 'crawlability'
  | 'content'
  | 'meta_tags'
  | 'links'
  | 'indexability'
  | 'http_status';

export type IssueHelpContent = {
  about: string[];
  bullets?: string[];
  badge?: string;
  badgeExtra?: string[];
  category: string;
  fix: string[];
  fixBullets?: boolean;
  showOptimizeAi?: boolean;
  articleLinks?: { label: string; href: string }[];
};

export type SiteAuditIssue = {
  id: string;
  title: string;
  severity: IssueSeverity;
  count: number;
  aiSearch?: boolean;
};

export type SiteAuditIssueSummary = {
  id: string;
  title: string;
  linkText: string;
  titleSuffix: string;
  severity: IssueSeverity;
  count: number;
  newCount: number;
  categories: IssueCategory[];
  aiSearch?: boolean;
  isNew?: boolean;
};

export type SiteAuditIssuesReport = {
  issues: SiteAuditIssueSummary[];
  categoryCounts: Record<IssueCategory, number>;
  severityCounts: {
    all: number;
    errors: number;
    warnings: number;
    notices: number;
  };
};

export type IssueInstance = {
  id: string;
  url: string;
  title?: string;
  secondaryUrl?: string;
  sitemapUrl?: string;
  ratio?: number;
  titleLength?: number;
  incomingCount?: number;
  anchor?: string;
  subdomain?: string;
  issueType?: string;
  discoveredAt: string | null;
  isNew: boolean;
  score: number | null;
  fetchStatus: string | null;
};

export type IssueDetailLayout =
  | 'default'
  | 'sitemap'
  | 'malformedUrl'
  | 'textRatio'
  | 'permanentRedirect'
  | 'linkIssue'
  | 'incomingLinks'
  | 'hsts'
  | 'external403'
  | 'titleLength';

export type SiteAuditIssueDetailPayload = {
  issue: SiteAuditIssueSummary;
  failed: number;
  successful: number;
  instances: IssueInstance[];
  layout: IssueDetailLayout;
  updatedAt: string | null;
};

export type ThematicReport = {
  id: string;
  title: string;
  score: number | null;
  deltaLabel: string;
  notice?: string;
  href?: string;
  externalHref?: string;
  actionLabel: string;
};

export type PageIssueCounts = {
  total: number;
  errors: number;
  warnings: number;
  notices: number;
};

export type CrawledPageRow = {
  id: string;
  url: string;
  title: string | null;
  score: number | null;
  statusCode: number | null;
  statusLabel: string;
  issueCount: number;
  issueErrors: number;
  issueWarnings: number;
  depth: number;
  bucket: PageBucket;
  blockedAiBots: number;
  totalAiBots: number;
  discoveredAt: string | null;
};

export type CrawledPagesReport = {
  pages: CrawledPageRow[];
  total: number;
  distribution: Record<PageBucket, number>;
  pagesLimit: number;
  atCrawlLimit: boolean;
  planSlug: string;
  planName: string;
  canUpgradeCrawlLimit: boolean;
  upgradePlanSlug: string | null;
  upgradePlanName: string | null;
  upgradePagesLimit: number | null;
};

export type CrawlSnapshotOption = {
  id: string;
  label: string;
  crawledAt: string;
};

export type CompareCrawlsRowKind = 'section' | 'general' | 'issue';

export type CompareCrawlsRow = {
  id: string;
  kind: CompareCrawlsRowKind;
  label: string;
  section?: 'general' | 'errors' | 'warnings' | 'notices';
  severity?: IssueSeverity;
  issueId?: string;
  olderValue?: number;
  newerValue?: number;
  fixed?: number | null;
  newCount?: number | null;
};

export type CompareCrawlsReport = {
  crawls: CrawlSnapshotOption[];
  olderCrawlId: string | null;
  newerCrawlId: string | null;
  rows: CompareCrawlsRow[];
  hasData: boolean;
};

export type SiteAuditOverviewPayload = {
  domain: string;
  slug: string;
  updatedAt: string | null;
  device: 'desktop';
  jsRendering: boolean;
  pagesCrawled: number;
  pagesLimit: number;
  atCrawlLimit: boolean;
  siteHealth: number;
  siteHealthDelta: number | null;
  benchmarkHealth: number;
  aiSearchHealth: number;
  aiSearchIssues: number;
  aiSearchNotice: string;
  crawledPages: {
    total: number;
    delta: number | null;
    distribution: Record<PageBucket, number>;
  };
  trends: {
    errors: number;
    warnings: number;
    errorsDelta: number | null;
    warningsDelta: number | null;
  };
  topInsights: SiteAuditIssue[];
  issuesReport: SiteAuditIssuesReport;
  thematicReports: ThematicReport[];
  hasData: boolean;
  setupJobStatus: string | null;
  planSlug: string;
  planName: string;
  canUpgradeCrawlLimit: boolean;
  upgradePlanSlug: string | null;
  upgradePlanName: string | null;
  upgradePagesLimit: number | null;
};
