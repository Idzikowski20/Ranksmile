import React, { useCallback, useMemo, useState } from 'react';
import type {
  PageBucket,
  SiteAuditIssue,
  SiteAuditOverviewPayload,
  ThematicReport,
} from '@/src/infrastructure/siteAudit/types';
import type { TickRingSegment } from '@/src/core/domain/siteAudit/tickRing';
import { Button } from '../koala/core';
import { TickRingWidget } from '../koala/product/TickRingWidget';
import { Icon } from '../koala/icons/Icon';
import { brandMain, green, orange, purple, red, yellow } from '../koala/tokens/colors';
import { dashedLinkStyle } from './InfoPopper';
import SiteAuditScoreGauge from './SiteAuditScoreGauge';
import SiteSpeedCard from './SiteSpeedCard';
import IssueTrendArea from './IssueTrendArea';
import OverviewInfoPopper, { type OverviewPopperKind } from './overviewPoppers';
import { BotRow, PRIMARY_BOTS } from './aiSearchBots';

const SITE_HEALTH_DOC = 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide';
const AI_SEARCH_DOC = 'https://developers.google.com/search/docs/appearance/ai-features';

const FONT = 'var(--font-family-primary)';

const CARD: React.CSSProperties = {
  borderRadius: 16,
  background: 'var(--koala-bg-primary)',
  border: '1px solid var(--koala-border-primary)',
};

const LINK_BLUE = '#2563EB';

const MUTED = '#52525C';
const TEXT = '#18181B';
const BORDER = '#e5e5e5';

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

/** Bucket colours read as their meaning: healthy green, issues orange, redirects yellow,
 *  broken red, blocked purple. */
const BUCKET_COLORS: Record<PageBucket, string> = {
  healthy: green[500],
  haveIssues: orange[400],
  redirects: yellow[500],
  broken: red[500],
  blocked: purple[500],
};

function siteHealthSegments(distribution: Record<PageBucket, number>): TickRingSegment[] {
  const order: PageBucket[] = ['healthy', 'haveIssues', 'redirects', 'broken', 'blocked'];
  return order.map((key) => ({ id: key, label: BUCKET_LABELS[key], value: distribution[key], color: BUCKET_COLORS[key] }));
}

function aiSearchSegments(score: number): TickRingSegment[] {
  const optimized = Math.max(0, Math.min(100, Math.round(score)));
  return [
    { id: 'optimized', label: 'Optimized', value: optimized, color: green[500] },
    { id: 'gap', label: 'Needs work', value: 100 - optimized, color: brandMain },
  ];
}

/** Delta chip next to the score ("No change vs last crawl", "+4% vs last crawl"). */
function DeltaChip({ label, positive }: { label: string | null; positive: boolean | null }) {
  if (!label) return null;
  const tone = positive === null ? 'neutral' : (positive ? 'up' : 'down');
  return (
    <span className={`tick-ring__delta tick-ring__delta--${tone}`}>
      <Icon name={positive === false ? 'TrendDown' : 'TrendUp'} size={12} />
      {label}
    </span>
  );
}

function formatHealthDelta(delta: number | null): { label: string | null; positive: boolean | null } {
  if (delta === null) return { label: null, positive: null };
  if (delta === 0) return { label: 'No change vs last crawl', positive: null };
  return {
    label: `${delta > 0 ? '+' : ''}${delta}% vs last crawl`,
    positive: delta > 0,
  };
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
    <div style={{ ...CARD, padding: 20, display: 'flex', flexDirection: 'column', minHeight: 160, border: 'none', boxShadow: 'none' }}>
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
  /** Domain slug — the Site Speed measurement posts to its API. */
  slug?: string;
  onViewAllIssues?: () => void;
};

export default function SiteAuditOverview({ data, slug, onViewAllIssues }: Props) {
  const dist = data.crawledPages.distribution;
  const [popper, setPopper] = useState<{ kind: OverviewPopperKind; rect: DOMRect } | null>(null);
  const siteSegments = useMemo(() => siteHealthSegments(dist), [dist]);
  const aiSegments = useMemo(() => aiSearchSegments(data.aiSearchHealth), [data.aiSearchHealth]);
  const siteDelta = formatHealthDelta(data.siteHealthDelta);

  const openPopper = useCallback((kind: OverviewPopperKind) => (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopper((cur) => (cur?.kind === kind ? null : { kind, rect }));
  }, []);

  const closePopper = useCallback(() => setPopper(null), []);

  const isInfoOpen = (kind: OverviewPopperKind) => popper?.kind === kind;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
      <section className="overview-pair">
        <div className="koala-audit-overview-split">
          <div className="overview-pair__col overview-pair__col--divided">
            <TickRingWidget
              title="Site Health"
              icon="File"
              docHref={SITE_HEALTH_DOC}
              value={String(Math.round(data.siteHealth))}
              caption="Score"
              segments={siteSegments}
              emptyLabel="No crawled pages yet."
              footer={<DeltaChip label={siteDelta.label} positive={siteDelta.positive} />}
            />
          </div>
          <div className="overview-pair__col">
            <SiteSpeedCard speed={data.siteSpeed} enabled={data.siteSpeedEnabled} />
          </div>
        </div>
      </section>

      <section className="overview-pair">
        <div className="koala-audit-overview-split">
          <div style={{ flex: '1.1 1 260px', minWidth: 0, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column' }}>
            <TickRingWidget
              title="AI Search Health"
              icon="Sparkle"
              docHref={AI_SEARCH_DOC}
              value={String(Math.round(data.aiSearchHealth))}
              caption="Score"
              segments={aiSegments}
              formatValue={(s) => `${s.value}%`}
              badge={(
                <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', background: '#EFA00D', borderRadius: 4, padding: '2px 6px' }}>beta</span>
              )}
              footer={(
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <DeltaChip
                    label={data.aiSearchIssues > 0 ? `${data.aiSearchIssues} ${data.aiSearchIssues === 1 ? 'issue' : 'issues'}` : 'No AI issues'}
                    positive={data.aiSearchIssues === 0}
                  />
                  <span style={{ display: 'flex', gap: 16, fontSize: 13 }}>
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
                      aria-expanded={isInfoOpen('info-ai-search-health')}
                      onClick={openPopper('info-ai-search-health')}
                      style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--koala-text-brand)', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 500 }}
                    >
                      More info
                    </button>
                  </span>
                </div>
              )}
            />
          </div>
          <div style={{ flex: '1 1 220px', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', minWidth: 200 }}>
            <WidgetTitle
              onInfoClick={openPopper('info-blocked-ai-search')}
              infoOpen={isInfoOpen('info-blocked-ai-search')}
            >
              Blocked from AI Search
            </WidgetTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0 }}>
              {PRIMARY_BOTS.map((bot) => (
                <BotRow key={bot.id} bot={bot} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 16, fontSize: 13, flexWrap: 'wrap' }}>
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

      {popper && (
        <OverviewInfoPopper kind={popper.kind} anchorRect={popper.rect} onClose={closePopper} />
      )}

      <section className="overview-pair">
       <div className="koala-audit-overview-split">
        <div style={{ flex: '1 1 280px', minWidth: 0, borderRight: `1px solid ${BORDER}`, padding: '20px 24px 24px' }}>
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
        </div>

        <div
          style={{
            flex: '2 1 400px',
            minWidth: 0,
            padding: 0,
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
                  className="koala-audit-insight-row"
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
                        color: 'var(--koala-text-brand)',
                        background: 'var(--koala-bg-secondary)',
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
        </div>
       </div>
      </section>

      <section style={{ ...CARD, padding: '8px 0 16px' }}>
        <h2 style={{ margin: '0 0 8px', padding: '8px 20px', fontSize: 14, fontWeight: 600, color: TEXT }}>Thematic Reports</h2>
        <div className="koala-thematic-reports-grid">
          {data.thematicReports.map((report) => (
            <div key={report.id} className="koala-thematic-reports-cell">
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
