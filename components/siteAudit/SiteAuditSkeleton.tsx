import React from 'react';
import Skeleton from '../dashboard/Skeleton';

const CARD: React.CSSProperties = {
  borderRadius: 16,
  background: 'var(--koala-bg-primary)',
  border: '1px solid var(--koala-border-primary)',
  padding: 24,
};

/** Radial widget placeholder: title, big donut, legend lines. */
function RadialCardSkeleton({ flex }: { flex: string }) {
  return (
    <section style={{ ...CARD, flex, minWidth: 0 }} aria-hidden="true">
      <Skeleton width={140} height={16} style={{ marginBottom: 20 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Skeleton width={120} height={120} radius={60} style={{ flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          <Skeleton width="70%" height={12} />
          <Skeleton width="55%" height={12} />
          <Skeleton width="62%" height={12} />
          <Skeleton width="40%" height={12} />
        </div>
      </div>
    </section>
  );
}

/** Mirrors SiteAuditOverview layout while the overview payload loads. */
export function SiteAuditOverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading site audit" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <RadialCardSkeleton flex="1 1 420px" />
        <RadialCardSkeleton flex="1 1 520px" />
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <section style={{ ...CARD, flex: '1 1 280px' }} aria-hidden="true">
          <Skeleton width={100} height={14} style={{ marginBottom: 16 }} />
          <Skeleton width={72} height={36} style={{ marginBottom: 20 }} />
          <Skeleton width={100} height={14} style={{ marginBottom: 16 }} />
          <Skeleton width={72} height={36} />
        </section>
        <section style={{ ...CARD, flex: '2 1 480px' }} aria-hidden="true">
          <Skeleton width={160} height={16} style={{ marginBottom: 20 }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
              <Skeleton width={`${62 - i * 6}%`} height={12} />
              <Skeleton width={48} height={12} />
            </div>
          ))}
        </section>
      </div>
      <SiteAuditTableSkeleton rows={6} />
    </div>
  );
}

/** Mirrors SiteAuditIssueDetail: back button, header panel + table, aside column. */
export function SiteAuditIssueDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading issue details" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Skeleton width={100} height={32} radius={12} />
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={{ ...CARD, padding: '20px 24px' }} aria-hidden="true">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Skeleton width={260} height={18} />
              <Skeleton width={56} height={20} radius={10} />
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <Skeleton width={120} height={14} />
              <Skeleton width={120} height={14} />
            </div>
          </section>
          <SiteAuditTableSkeleton rows={8} />
        </div>
        <section style={{ ...CARD, flex: '0 1 320px', minWidth: 260 }} aria-hidden="true">
          <Skeleton width={140} height={16} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={12} style={{ marginBottom: 10 }} />
          <Skeleton width="86%" height={12} style={{ marginBottom: 10 }} />
          <Skeleton width="92%" height={12} style={{ marginBottom: 10 }} />
          <Skeleton width="60%" height={12} />
        </section>
      </div>
    </div>
  );
}

/** Generic table placeholder for issues / crawled pages / compare tabs. */
export function SiteAuditTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <section role="status" aria-label="Loading" style={{ ...CARD, padding: '20px 24px' }}>
      <Skeleton width={180} height={16} style={{ marginBottom: 20 }} />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          <Skeleton width={16} height={16} radius={4} style={{ flexShrink: 0 }} />
          <Skeleton width={`${68 - (i % 3) * 9}%`} height={12} />
          <Skeleton width={56} height={12} style={{ marginLeft: 'auto' }} />
        </div>
      ))}
    </section>
  );
}
