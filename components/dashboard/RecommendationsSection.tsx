import React from 'react';
import SectionHeader from './SectionHeader';
import Skeleton from './Skeleton';

const font = 'var(--font-family-primary)';

const BoltIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M13 2L4.09344 12.6879C3.74463 13.1064 3.57023 13.3157 3.56756 13.4925C3.56524 13.6461 3.63372 13.7923 3.75324 13.8889C3.89073 14 4.16316 14 4.70802 14H12L11 22L19.9065 11.3121C20.2553 10.8936 20.4297 10.6843 20.4324 10.5075C20.4347 10.3539 20.3663 10.2077 20.2467 10.1111C20.1092 10 19.8368 10 19.292 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const OptimizeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M21 21H4.6C4.03995 21 3.75992 21 3.54601 20.891C3.35785 20.7951 3.20487 20.6422 3.10899 20.454C3 20.2401 3 19.9601 3 19.4V3M21 7L15.5657 12.4343C15.3677 12.6323 15.2687 12.7313 15.1545 12.7684C15.0541 12.8011 14.9459 12.8011 14.8455 12.7684C14.7313 12.7313 14.6323 12.6323 14.4343 12.4343L12.5657 10.5657C12.3677 10.3677 12.2687 10.2687 12.1545 10.2316C12.0541 10.1989 11.9459 10.1989 11.8455 10.2316C11.7313 10.2687 11.6323 10.3677 11.4343 10.5657L7 15M21 7H17M21 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Star = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401l-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102l-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637l3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382z" clipRule="evenodd" />
  </svg>
);

const Chevron = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10L8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
  </svg>
);

interface RecommendationBase {
  id: string | number;
  title: string;
  href: string;
}
// A recommendation carries EXACTLY ONE measure: a content score (analyzed articles)
// or a priority (domain pipeline scan output). The union stops mixed shapes at compile time
// and lets `'priority' in item` narrow which one a Row is rendering.
export type RecommendationItem =
  | (RecommendationBase & { score: number })
  | (RecommendationBase & { priority: string });

const PRIORITY_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  high: { color: '#FF6F77', bg: 'rgba(255,111,119,0.1)', label: 'High' },
  medium: { color: '#D97706', bg: '#FFF7ED', label: 'Medium' },
  low: { color: '#71717B', bg: '#F4F4F5', label: 'Low' },
};

const PriorityPill = ({ priority }: { priority: string }) => {
  const s = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.low;
  return (
    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 9999, padding: '2px 8px', lineHeight: '16px', fontFamily: font }}>
      {s.label}
    </span>
  );
};

const CheckCircle = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="#1AB25E" fillOpacity="0.1" />
    <path d="M8 12.5L10.5 15L16 9" stroke="#1AB25E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface Props {
  items: RecommendationItem[];
  total: number;
  faviconDomain: string;
  viewHref: string;
  loading: boolean;
  /** When set (domain pipeline running), shown inside the card instead of the rows. */
  pipeline?: React.ReactNode;
}

const RowSkeleton = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <Skeleton width={16} height={16} radius={4} />
    <Skeleton width={64} height={13} />
    <Skeleton width={16} height={16} radius={4} />
    <Skeleton width="45%" height={14} style={{ flex: 1 }} />
    <Skeleton width={36} height={13} />
  </div>
);

const Row = ({ item, faviconDomain }: { item: RecommendationItem; faviconDomain: string }) => (
  <a
    href={item.href}
    className="dashboard-rec-row"
    style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8, color: '#18181B', textDecoration: 'none' }}
  >
    <span style={{ color: '#52525C', marginRight: 4, display: 'inline-flex' }}><OptimizeIcon /></span>
    <span style={{ flexShrink: 0, fontSize: 13, color: '#52525C', fontFamily: font }}>Optimize</span>
    {faviconDomain && (
      <img alt="" width={16} height={16} style={{ borderRadius: 4, flexShrink: 0 }} src={`https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=32`} />
    )}
    <span style={{ minWidth: 0, flex: 1, fontSize: 14, fontWeight: 500, color: '#52525C', fontFamily: font, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
      {item.title}
    </span>
    {'priority' in item ? (
      <PriorityPill priority={item.priority} />
    ) : (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, color: '#9F9FA9' }}>
        <Star />
        <span style={{ fontSize: 13, fontFamily: font }}>{(item.score / 10).toFixed(1)}</span>
      </span>
    )}
  </a>
);

// Single source of truth for the section frame — header + bordered box. Per-state
// padding/layout is passed via boxStyle; the border lives here so it can't drift.
const SECTION_BOX: React.CSSProperties = { border: '1px solid #E4E4E7', borderRadius: 16 };
const colStack: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 };

const SectionShell = ({ boxStyle, children }: { boxStyle?: React.CSSProperties; children: React.ReactNode }) => (
  <div style={colStack}>
    <SectionHeader icon={<BoltIcon />} label="Recommendations" />
    <div style={{ ...SECTION_BOX, ...boxStyle }}>{children}</div>
  </div>
);

const RecommendationsSection = ({ items, total, faviconDomain, viewHref, loading, pipeline }: Props) => {
  // While the domain pipeline runs, the section shows its progress in place of the rows.
  if (pipeline) {
    return <SectionShell boxStyle={{ padding: 24 }}>{pipeline}</SectionShell>;
  }
  if (loading) {
    return (
      <SectionShell boxStyle={{ ...colStack, padding: 24 }}>
        <RowSkeleton />
        <RowSkeleton />
        <Skeleton width={150} height={13} />
      </SectionShell>
    );
  }
  if (items.length === 0) {
    return (
      <SectionShell boxStyle={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
        <CheckCircle />
        <span style={{ fontSize: 16, fontWeight: 600, color: '#18181B', fontFamily: font }}>Your domain looks healthy</span>
        <span style={{ fontSize: 14, color: '#52525C', maxWidth: 420, lineHeight: 1.5, fontFamily: font }}>
          The scan finished and found no pages that need optimization right now. As your content changes, new opportunities will show up here.
        </span>
      </SectionShell>
    );
  }
  return (
    <SectionShell boxStyle={{ ...colStack, padding: 24 }}>
      <div style={colStack}>
        {items.map((item) => <Row key={item.id} item={item} faviconDomain={faviconDomain} />)}
      </div>
      <a
        href={viewHref}
        className="dashboard-rec-view"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, color: '#52525C', textDecoration: 'none', fontFamily: font }}
      >
        <span>View {total} {total === 1 ? 'Recommendation' : 'Recommendations'}</span>
        <Chevron />
      </a>
    </SectionShell>
  );
};

export default RecommendationsSection;
