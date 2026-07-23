import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '../core';
import { dashedLinkStyle } from './InfoPopper';
import SiteAuditScoreGauge from './SiteAuditScoreGauge';
import SiteHealthIssueBar, { type HealthIssueSegment } from './SiteHealthIssueBar';
import IssueTrendArea from './IssueTrendArea';
import OverviewInfoPopper, { type OverviewPopperKind } from './overviewPoppers';
import { BotRow, PRIMARY_BOTS } from './aiSearchBots';
import type {
  PageBucket,
  SiteAuditIssue,
  SiteAuditOverviewPayload,
  ThematicReport,
} from '../../lib/siteAudit/types';

const FONT = 'var(--font-family-primary)';

const CARD: React.CSSProperties = {
  borderRadius: 12,
  background: '#FFFFFF',
};

const LINK_BLUE = '#2563EB';

const MUTED = '#52525C';
const TEXT = '#18181B';
const BORDER = '#E4E4E7';

const BUCKET_COLORS: Record<PageBucket, string> = {
  healthy: 'rgb(129, 224, 34)',
  broken: 'rgb(252, 219, 3)',
  haveIssues: 'rgb(186, 232, 76)',
  redirects: 'rgb(107, 92, 231)',
  blocked: 'rgb(212, 212, 216)',
};

const BUCKET_LABELS: Record<PageBucket, string> = {
  healthy: 'Healthy',
  broken: 'Broken',
  haveIssues: 'Have issues',
  redirects: 'Redirects',
  blocked: 'Blocked',
};

const SEVERITY_COLORS = {
  error: '#FF6F77',
  warning: '#EFA00D',
  notice: '#52525C',
} as const;

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M7.82 6a1 1 0 0 1 .99 1.16L8 12h2a1 1 0 1 1 0 2H7.18a1 1 0 0 1-.99-1.16L7 8H6a1 1 0 0 1 0-2h1.82ZM8.5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        fill={MUTED}
      />
    </svg>
  );
}

function OverviewScoreGauge({
  score,
  deltaLabel = 'no changes',
  size = 140,
  variant = 'watchtower',
}: {
  score: number;
  deltaLabel?: string | null;
  size?: number;
  variant?: 'watchtower' | 'compact';
}) {
  return (
    <div className="sentry-site-audit-score-gauge">
      <SiteAuditScoreGauge score={score} size={size} variant={variant} showLabel={variant === 'watchtower'} />
      {deltaLabel ? (
        <span className="sentry-site-audit-score-gauge-delta">{deltaLabel}</span>
      ) : null}
    </div>
  );
}

function crawledPagesBarSegments(distribution: Record<PageBucket, number>): HealthIssueSegment[] {
  return [
    { id: 'healthy', label: BUCKET_LABELS.healthy, count: distribution.healthy, color: 'rgb(129, 224, 34)' },
    { id: 'haveIssues', label: BUCKET_LABELS.haveIssues, count: distribution.haveIssues, color: 'rgb(186, 232, 76)' },
    { id: 'redirects', label: BUCKET_LABELS.redirects, count: distribution.redirects, color: 'rgb(107, 92, 231)' },
    { id: 'broken', label: BUCKET_LABELS.broken, count: distribution.broken, color: 'rgb(252, 219, 3)' },
    { id: 'blocked', label: BUCKET_LABELS.blocked, count: distribution.blocked, color: 'rgb(212, 212, 216)' },
  ];
}

function WidgetTitle({
  children,
  onInfoClick,
  infoOpen,
}: {
  children: React.ReactNode;
  onInfoClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  infoOpen?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT, fontFamily: FONT }}>{children}</h2>
      {onInfoClick && (
        <button
          type="button"
          aria-label="More info"
          aria-expanded={infoOpen}
          onClick={onInfoClick}
          style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex' }}
        >
          <InfoIcon />
        </button>
      )}
    </div>
  );
}

function IssueIcon({ severity }: { severity: SiteAuditIssue['severity'] }) {
  const color = SEVERITY_COLORS[severity];
  if (severity === 'error') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={color} aria-hidden="true">
        <path d="M5.03 16a1 1 0 0 1-.41-.09 1 1 0 0 1-.57-1.14L5.41 9H4a1 1 0 0 1-.75-.35 1 1 0 0 1-.24-.8l1-7a1 1 0 0 1 1-.85h5a1 1 0 0 1 .94 1.39L9.83 4h2.22a1 1 0 0 1 .89.53 1 1 0 0 1-.07 1l-7 10a1 1 0 0 1-.84.47Z" />
      </svg>
    );
  }
  if (severity === 'warning') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill={color} aria-hidden="true">
        <path d="M7 6h2v4H7V6Zm2 7v-2H7v2h2Z" />
        <path fillRule="evenodd" clipRule="evenodd" d="M6.152 1.172c.719-1.563 2.977-1.563 3.696 0l6.043 13.141c.363.791-.225 1.687-1.109 1.687H1.218c-.884 0-1.472-.896-1.109-1.687L6.152 1.172Zm7.374 12.837L8 1.99 2.474 14.01h11.052Z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={color} aria-hidden="true">
      <path d="M9 12H7V7h2zm0-6H7V4h2z" />
      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0m0 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2" />
    </svg>
  );
}

function ThematicCard({
  report,
  onInfoClick,
  infoOpen,
}: {
  report: ThematicReport;
  onInfoClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  infoOpen?: boolean;
}) {
  const href = report.externalHref ?? report.href;
  return (
    <div className="perf-3d-card" style={{ ...CARD, padding: 20, display: 'flex', flexDirection: 'column', minHeight: 160, border: 'none', boxShadow: 'none' }}>
      <WidgetTitle onInfoClick={onInfoClick} infoOpen={infoOpen}>{report.title}</WidgetTitle>
      {report.notice ? (
        <p style={{ margin: '0 0 16px', fontSize: 12, color: MUTED, fontFamily: FONT, lineHeight: 1.5 }}>{report.notice}</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          {report.score !== null && <SiteAuditScoreGauge score={report.score} size={48} variant="compact" />}
          {report.deltaLabel && (
            <span style={{ fontSize: 12, color: MUTED, fontFamily: FONT }}>{report.deltaLabel}</span>
          )}
        </div>
      )}
      {href ? (
        <a
          href={href}
          target={report.externalHref ? '_blank' : undefined}
          rel={report.externalHref ? 'noreferrer' : undefined}
          style={{ marginTop: 'auto', textDecoration: 'none' }}
        >
          <Button type="button" variant="secondary" size="sm">{report.actionLabel}</Button>
        </a>
      ) : (
        <Button type="button" variant="secondary" size="sm" disabled style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>
          {report.actionLabel}
        </Button>
      )}
    </div>
  );
}

type Props = {
  data: SiteAuditOverviewPayload;
  onViewAllIssues?: () => void;
};

export default function SiteAuditOverview({ data, onViewAllIssues }: Props) {
  const dist = data.crawledPages.distribution;
  const [popper, setPopper] = useState<{ kind: OverviewPopperKind; rect: DOMRect } | null>(null);
  const crawledBarSegments = useMemo(() => crawledPagesBarSegments(dist), [dist]);

  const openPopper = useCallback((kind: OverviewPopperKind) => (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopper((cur) => (cur?.kind === kind ? null : { kind, rect }));
  }, []);

  const closePopper = useCallback(() => setPopper(null), []);

  const isInfoOpen = (kind: OverviewPopperKind) => popper?.kind === kind;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <section className="perf-3d-card" style={{ ...CARD, flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ display: 'flex', minHeight: 280 }}>
            <div style={{ flex: 1, padding: '12px 20px', borderRight: `1px solid ${BORDER}` }}>
              <WidgetTitle
                onInfoClick={openPopper('info-site-health')}
                infoOpen={isInfoOpen('info-site-health')}
              >
                Site Health
              </WidgetTitle>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                <OverviewScoreGauge
                  score={data.siteHealth}
                  deltaLabel={data.siteHealthDelta === null ? 'no changes' : `${data.siteHealthDelta > 0 ? '+' : ''}${data.siteHealthDelta}%`}
                  size={148}
                  variant="watchtower"
                />
                <div style={{ width: '100%', marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#D1002F' }}>▼</span>
                    <span style={{ fontSize: 13, color: TEXT, flex: 1, marginLeft: 4 }}>Top-10% websites</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{data.benchmarkHealth}%</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, padding: '12px 20px' }}>
              <WidgetTitle
                onInfoClick={openPopper('info-crawled-pages')}
                infoOpen={isInfoOpen('info-crawled-pages')}
              >
                Crawled Pages
              </WidgetTitle>
              <div className="sentry-cp-overview-row">
                <a
                  href={`/sites/${data.slug}/site-audit`}
                  className="sentry-cp-overview-total"
                  data-test-id="crawled-pages-total"
                  aria-label={`Open all ${data.crawledPages.total} crawled pages`}
                >
                  {data.crawledPages.total}
                </a>
                <span className="sentry-cp-overview-delta" data-test-id="crawled-pages-delta">
                  {data.crawledPages.delta === null ? 'no changes' : `${data.crawledPages.delta > 0 ? '+' : ''}${data.crawledPages.delta}`}
                </span>
                <div className="sentry-cp-overview-issue-bar" data-test-id="crawled-pages-chart">
                  <SiteHealthIssueBar segments={crawledBarSegments} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '6px 12px', fontSize: 13, marginBottom: 4 }}>
                {(['healthy', 'broken', 'haveIssues', 'redirects', 'blocked'] as PageBucket[]).map((key) => (
                  <React.Fragment key={key}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: BUCKET_COLORS[key], alignSelf: 'center' }} />
                    <span style={{ color: TEXT }}>{BUCKET_LABELS[key]}</span>
                    <span style={{ textAlign: 'right', color: dist[key] ? TEXT : MUTED, fontWeight: dist[key] ? 500 : 400 }}>
                      {dist[key]}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="perf-3d-card" style={{ ...CARD, flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ display: 'flex', minHeight: 280 }}>
            <div style={{ flex: 1, padding: '12px 20px 20px', borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT, fontFamily: FONT }}>AI Search Health</h2>
                <button
                  type="button"
                  aria-label="More info"
                  aria-expanded={isInfoOpen('info-ai-search-health')}
                  onClick={openPopper('info-ai-search-health')}
                  style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex' }}
                >
                  <InfoIcon />
                </button>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', background: '#EFA00D', borderRadius: 4, padding: '2px 6px' }}>beta</span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                <OverviewScoreGauge score={data.aiSearchHealth} size={148} variant="watchtower" />
                <div
                  style={{
                    width: '100%',
                    minHeight: 48,
                    marginTop: 16,
                    marginBottom: 12,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: '#F0F0F2',
                    fontSize: 12,
                    color: TEXT,
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {data.aiSearchNotice}
                </div>
                <div style={{ width: '100%', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, fontSize: 13 }}>
                  <button
                    type="button"
                    aria-expanded={popper?.kind === 'how-it-works'}
                    onClick={openPopper('how-it-works')}
                    style={dashedLinkStyle}
                  >
                    How it works
                  </button>
                  <button
                    type="button"
                    style={{ border: 'none', background: 'transparent', padding: 0, color: '#783AFB', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 500 }}
                  >
                    {data.aiSearchIssues} {data.aiSearchIssues === 1 ? 'issue' : 'issues'}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, padding: '12px 20px 20px', display: 'flex', flexDirection: 'column' }}>
              <WidgetTitle
                onInfoClick={openPopper('info-blocked-ai-search')}
                infoOpen={isInfoOpen('info-blocked-ai-search')}
              >
                Blocked from AI Search
              </WidgetTitle>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: MUTED }}>
                Pages crawled:
                {' '}
                {data.pagesCrawled}
                /
                {data.pagesLimit}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {PRIMARY_BOTS.map((bot) => (
                  <BotRow key={bot.id} bot={bot} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 16, fontSize: 13 }}>
                <button
                  type="button"
                  aria-expanded={popper?.kind === 'show-more'}
                  onClick={openPopper('show-more')}
                  style={dashedLinkStyle}
                >
                  Show more
                </button>
                <button
                  type="button"
                  aria-expanded={popper?.kind === 'unblock'}
                  onClick={openPopper('unblock')}
                  style={dashedLinkStyle}
                >
                  How to unblock pages
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {popper && (
        <OverviewInfoPopper kind={popper.kind} anchorRect={popper.rect} onClose={closePopper} />
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <section className="perf-3d-card" style={{ ...CARD, flex: '1 1 280px', padding: '20px 24px 24px' }}>
          <WidgetTitle
            onInfoClick={openPopper('info-errors')}
            infoOpen={isInfoOpen('info-errors')}
          >
            Errors
          </WidgetTitle>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#FF6F77', marginBottom: 8, lineHeight: 1 }}>{data.trends.errors}</div>
          <IssueTrendArea value={data.trends.errors} color="#FF6F77" />
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: `1px solid ${BORDER}` }}>
            <WidgetTitle
              onInfoClick={openPopper('info-warnings')}
              infoOpen={isInfoOpen('info-warnings')}
            >
              Warnings
            </WidgetTitle>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#EFA00D', marginBottom: 8, lineHeight: 1 }}>{data.trends.warnings}</div>
            <IssueTrendArea value={data.trends.warnings} color="#EFA00D" />
          </div>
        </section>

        <section
          className="perf-3d-card"
          style={{
            ...CARD,
            flex: '2 1 400px',
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, fontSize: 14, fontWeight: 600, color: TEXT }}>
            Top insights
          </div>
          {data.topInsights.length === 0 ? (
            <p style={{ padding: 24, margin: 0, color: MUTED, fontSize: 14, flex: 1 }}>No issues detected on crawled pages.</p>
          ) : (
            <div style={{ flex: 1 }}>
              {data.topInsights.map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                    gap: '0 20px',
                    alignItems: 'center',
                    padding: '13px 20px',
                    borderBottom: `1px solid ${BORDER}`,
                    minHeight: 48,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ flexShrink: 0, display: 'flex' }}>
                      <IssueIcon severity={issue.severity} />
                    </span>
                    <span style={{ fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {issue.title}
                    </span>
                    {issue.aiSearch && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#783AFB',
                        background: '#F4F0FF',
                        borderRadius: 4,
                        padding: '2px 6px',
                        flexShrink: 0,
                        letterSpacing: '0.02em',
                      }}
                      >
                        AI Search
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: LINK_BLUE,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: FONT,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {issue.count} {issue.count === 1 ? 'page' : 'pages'}
                  </button>
                  <button
                    type="button"
                    style={{
                      ...dashedLinkStyle,
                      fontSize: 14,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    How to fix
                  </button>
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              marginTop: 'auto',
              padding: '14px 20px',
              borderTop: `1px solid ${BORDER}`,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={onViewAllIssues}
              style={{
                ...dashedLinkStyle,
                fontSize: 14,
              }}
            >
              View all issues →
            </button>
          </div>
        </section>
      </div>

      <section className="perf-3d-card" style={{ ...CARD, padding: '8px 0 16px' }}>
        <h2 style={{ margin: '0 0 8px', padding: '8px 20px', fontSize: 14, fontWeight: 600, color: TEXT }}>Thematic Reports</h2>
        <div className="sentry-thematic-reports-grid">
          {data.thematicReports.map((report) => (
            <div key={report.id} className="sentry-thematic-reports-cell">
              <ThematicCard
                report={report}
                onInfoClick={report.id === 'robots' ? openPopper('info-robots-txt') : undefined}
                infoOpen={report.id === 'robots' && isInfoOpen('info-robots-txt')}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
