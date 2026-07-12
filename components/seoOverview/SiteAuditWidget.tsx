import React from 'react';
import Link from 'next/link';
import type { SiteAuditSection } from '../../lib/seoOverview/types';
import { workspaceHref } from '../../lib/activeWorkspace';
import { cardFlex, FONT, ViewFullReport, WidgetHeader } from './widgetStyles';

type Props = {
  data: SiteAuditSection;
  slug: string;
  workspaceId: number | null;
  loading?: boolean;
};

const HealthGauge = ({ value }: { value: number }) => {
  const pct = Math.max(0, Math.min(100, value));
  const angle = (pct / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const x = 50 + 40 * Math.cos(Math.PI - rad);
  const y = 50 - 40 * Math.sin(Math.PI - rad);
  const large = angle > 90 ? 1 : 0;
  return (
    <svg width="100" height="56" viewBox="0 0 100 56" aria-hidden="true">
      <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#F4F4F5" strokeWidth="8" strokeLinecap="round" />
      <path d={`M10 50 A40 40 0 ${large} 1 ${x} ${y}`} fill="none" stroke="#783AFB" strokeWidth="8" strokeLinecap="round" />
      <text x="50" y="48" textAnchor="middle" fontSize="16" fontWeight="700" fill="#18181B" fontFamily={FONT}>{value}%</text>
    </svg>
  );
};

const DistributionBar = ({ distribution }: { distribution: SiteAuditSection['distribution'] }) => {
  const total = distribution.healthy + distribution.broken + distribution.haveIssues + distribution.redirects || 1;
  const segs = [
    { key: 'healthy', color: '#1AB25E', w: distribution.healthy },
    { key: 'issues', color: '#F59E0B', w: distribution.haveIssues },
    { key: 'broken', color: '#FF6F77', w: distribution.broken },
    { key: 'redirects', color: '#74A9FF', w: distribution.redirects },
  ];
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#F4F4F5' }}>
      {segs.filter((s) => s.w > 0).map((s) => (
        <div key={s.key} style={{ width: `${(s.w / total) * 100}%`, background: s.color }} />
      ))}
    </div>
  );
};

const SiteAuditWidget = ({ data, slug, workspaceId, loading }: Props) => {
  const href = workspaceHref(workspaceId, `/sites/${slug}/audit-tool`);
  const updated = data.updatedAt
    ? new Date(data.updatedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <section style={cardFlex} aria-label="Site Audit">
      <WidgetHeader
        title="Site Audit"
        meta={updated ? (
          <div style={{ fontSize: 12, color: '#9F9FA9', fontFamily: FONT }}>Updated on {updated}</div>
        ) : undefined}
      />
      <div style={{ padding: '16px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ height: 160, borderRadius: 8, background: '#E8E8ED' }} />
        ) : !data.configured ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 160, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: FONT }}>Run a content audit to see site health.</p>
            <Link href={href} style={{
              display: 'inline-flex', padding: '8px 14px', borderRadius: 8, background: '#2F2F34',
              color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: FONT,
            }}
            >
              Set up
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT, marginBottom: 4 }}>Site Health</div>
                {data.health != null && <HealthGauge value={data.health} />}
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#9F9FA9', fontFamily: FONT }}>Errors</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{data.errors}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#9F9FA9', fontFamily: FONT }}>Warnings</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{data.warnings}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 12, color: '#9F9FA9', fontFamily: FONT, marginBottom: 6 }}>Crawled Pages</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#18181B', fontFamily: FONT, marginBottom: 8 }}>{data.crawledPages}</div>
                  <DistributionBar distribution={data.distribution} />
                </div>
              </div>
            </div>
            <ViewFullReport href={href} />
          </>
        )}
      </div>
    </section>
  );
};

export default SiteAuditWidget;
