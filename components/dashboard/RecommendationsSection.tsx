import React from 'react';
import SectionHeader from './SectionHeader';

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

export interface RecommendationItem {
  id: string | number;
  title: string;
  score: number; // 0-100 content score
  href: string;
}

interface Props {
  items: RecommendationItem[];
  total: number;
  faviconDomain: string;
  viewHref: string;
}

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
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, color: '#9F9FA9' }}>
      <Star />
      <span style={{ fontSize: 13, fontFamily: font }}>{(item.score / 10).toFixed(1)}</span>
    </span>
  </a>
);

const RecommendationsSection = ({ items, total, faviconDomain, viewHref }: Props) => {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader icon={<BoltIcon />} label="Recommendations" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, border: '1px solid #F4F4F5', borderRadius: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
      </div>
    </div>
  );
};

export default RecommendationsSection;
