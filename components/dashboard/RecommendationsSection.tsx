import React from 'react';
import { Flex, Container } from '../koala/core/layout';
import { Text } from '../koala/core/text';
import { KoalaPanel, KoalaPanelHeader } from '../koala/layout';
import { ListWidget } from '../koala/product';
import Skeleton from './Skeleton';
import DomainFavicon from '../common/DomainFavicon';

const BoltIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0">
    <path d="M13 2L4.09344 12.6879C3.74463 13.1064 3.57023 13.3157 3.56756 13.4925C3.56524 13.6461 3.63372 13.7923 3.75324 13.8889C3.89073 14 4.16316 14 4.70802 14H12L11 22L19.9065 11.3121C20.2553 10.8936 20.4297 10.6843 20.4324 10.5075C20.4347 10.3539 20.3663 10.2077 20.2467 10.1111C20.1092 10 19.8368 10 19.292 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Ranksmile "optimize" glyph (sun w/ face) — turns dark on row hover via .rec-optimize-ico. */
const OptimizeGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="rec-optimize-ico flex-shrink-0 text-gray-60">
    <path fillRule="evenodd" clipRule="evenodd" d="M1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12C23 14.363 22.2549 16.552 20.9869 18.3448C20.8246 18.5742 20.7435 18.6889 20.6222 18.745C20.5207 18.7919 20.3902 18.803 20.2823 18.7739C20.1533 18.7391 20.0468 18.6326 19.8339 18.4197L19.5011 18.0869C18.887 17.4724 18.4619 17.047 17.9556 16.7368C17.5083 16.4627 17.0205 16.2607 16.5104 16.1382C15.9331 15.9996 15.3317 15.9998 14.463 16L9.53698 16C8.66824 15.9998 8.06691 15.9996 7.48961 16.1382C6.97944 16.2607 6.49172 16.4627 6.04437 16.7369C5.53816 17.0471 5.11307 17.4724 4.49895 18.0869L4.16609 18.4197C3.95317 18.6327 3.8467 18.7391 3.71771 18.7739C3.60978 18.803 3.47928 18.7919 3.37781 18.745C3.25654 18.6889 3.17541 18.5742 3.01315 18.3448C1.74509 16.552 1 14.363 1 12ZM13 3C13 2.44772 12.5523 2 12 2C11.4477 2 11 2.44772 11 3V5.25C11 5.80228 11.4477 6.25 12 6.25C12.5523 6.25 13 5.80228 13 5.25V3ZM3 11C2.44772 11 2 11.4477 2 12C2 12.5523 2.44772 13 3 13H5.25C5.80228 13 6.25 12.5523 6.25 12C6.25 11.4477 5.80228 11 5.25 11H3ZM18.75 11C18.1977 11 17.75 11.4477 17.75 12C17.75 12.5523 18.1977 13 18.75 13H21C21.5523 13 22 12.5523 22 12C22 11.4477 21.5523 11 21 11H18.75ZM6.33656 4.99284C5.94604 4.60232 5.31287 4.60232 4.92235 4.99284C4.53182 5.38337 4.53182 6.01653 4.92235 6.40706L6.48515 7.96986C6.87568 8.36039 7.50884 8.36039 7.89937 7.96986C8.28989 7.57934 8.28989 6.94617 7.89937 6.55565L6.33656 4.99284ZM19.0727 6.41205C19.4659 6.02431 19.4704 5.39116 19.0827 4.99787C18.6949 4.60459 18.0618 4.6001 17.6685 4.98785L12.6478 9.93785C12.6052 9.97989 12.5671 10.0248 12.5336 10.072C12.3638 10.0251 12.1848 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14C13.1046 14 14 13.1046 14 12C14 11.8151 13.9749 11.6361 13.928 11.4661C13.9714 11.4353 14.0129 11.4006 14.052 11.3621L19.0727 6.41205Z" fill="currentColor" />
    <path d="M18.1674 19.5817L18.4197 19.8339C18.6326 20.0469 18.7391 20.1533 18.7738 20.2823C18.8029 20.3903 18.7918 20.5208 18.7449 20.6222C18.6889 20.7435 18.5742 20.8246 18.3447 20.9869C16.5519 22.2549 14.363 23 12 23C9.63703 23 7.44808 22.2549 5.65527 20.9869C5.42586 20.8246 5.31115 20.7435 5.25509 20.6222C5.20819 20.5208 5.19708 20.3903 5.22617 20.2823C5.26093 20.1533 5.36739 20.0469 5.58032 19.834L5.8326 19.5817C6.55806 18.8562 6.81009 18.6133 7.08936 18.4421C7.35777 18.2777 7.6504 18.1565 7.95651 18.083C8.275 18.0065 8.62499 18.0001 9.65094 18.0001L14.349 18C15.375 18 15.725 18.0065 16.0435 18.0829C16.3496 18.1564 16.6422 18.2776 16.9106 18.4421C17.1899 18.6133 17.442 18.8562 18.1674 19.5817Z" fill="currentColor" />
  </svg>
);

const Star = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true" className="flex-shrink-0">
    <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401l-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102l-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637l3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382z" clipRule="evenodd" />
  </svg>
);

const Chevron = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true" className="flex-shrink-0">
    <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10L8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
  </svg>
);

interface RecommendationBase {
  id: string | number;
  title: string;
  href: string;
  /** 'optimize' (score-gauge row) | 'create' (priority-pill row). Drives sub-section grouping. */
  type?: string;
}
// A recommendation carries EXACTLY ONE measure: a content score (audited posts that
// need optimization) or a priority (LLM "create new content" ideas). The union stops
// mixed shapes at compile time and lets `'priority' in item` narrow which one a Row is
// rendering. Optimize items may also carry a word_count (shown next to the score).
export type RecommendationItem =
  | (RecommendationBase & { score: number; wordCount?: number })
  | (RecommendationBase & { priority: string });

// Create-content recs carry a priority instead of a content score; map it onto the same
// 1–10 rating scale (high = most worth doing) so every row shows a star, not a pill.
const PRIORITY_RATING: Record<string, number> = { high: 9, medium: 6, low: 3 };

const CheckCircle = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="var(--koala-status-success)" fillOpacity="0.1" />
    <path d="M8 12.5L10.5 15L16 9" stroke="var(--koala-status-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  /** Blog-audit coverage from the scan; drives the "Audited X of Y" footnote. */
  coverage?: { audited: number; skipped: number; total: number } | null;
  /** False ⇒ the domain has no blog_paths set; the empty state prompts to set one. */
  hasBlogPath?: boolean;
  /** Where the domain-settings blog-path field lives (no-path empty-state link). */
  settingsHref?: string;
}

const RowSkeleton = ({ divider }: { divider?: boolean }) => (
  <Flex align="center" gap="md" paddingTop="lg" paddingBottom="lg" paddingLeft="xl" paddingRight="xl" borderTop={divider ? 'md' : undefined}>
    <Skeleton width={18} height={18} radius={9999} />
    <Skeleton width={64} height={13} />
    <Skeleton width={16} height={16} radius={4} />
    <Container flex="1"><Skeleton width="45%" height={14} /></Container>
    <Skeleton width={36} height={13} />
  </Flex>
);

/**
 * Optimization priority on a 1–10 scale (10 = most urgent). The stored score is the
 * page's content quality (0–100, higher = better), so priority is the inverse: a weak
 * page surfaces near 10, a strong one near 1.
 */
const optimizeRating = (score: number) => Math.max(1, Math.min(10, (100 - score) / 10));

/** The 1–10 star value for any row: priority-derived for create recs, score-derived otherwise. */
const rowRating = (item: RecommendationItem) => (
  'priority' in item ? (PRIORITY_RATING[item.priority] ?? 5) : optimizeRating(item.score)
);

const Row = ({ item, faviconDomain, divider }: { item: RecommendationItem; faviconDomain: string; divider?: boolean }) => {
  const isCreate = 'priority' in item;
  return (
  <Container
    as="a"
    href={item.href}
    className="dashboard-rec-row"
    display="flex"
    alignItems="center"
    gap="md"
    paddingTop="lg"
    paddingBottom="lg"
    paddingLeft="xl"
    paddingRight="xl"
    borderTop={divider ? 'md' : undefined}
  >
    <OptimizeGlyph />
    <Text as="span" size="sm" variant="muted" wrap="nowrap">{isCreate ? 'Create' : 'Optimize'}</Text>
    {faviconDomain && (
      <DomainFavicon domain={faviconDomain} size={16} className="rounded flex-shrink-0" />
    )}
    <Text as="span" size="md" bold variant="muted" ellipsis className="rec-title flex-1 transition-colors">
      {item.title}
    </Text>
    <Flex align="center" gap="md" flexShrink={0}>
      {!('priority' in item) && item.wordCount != null && (
        <Text as="span" size="sm" variant="muted">{item.wordCount} words</Text>
      )}
      <Flex align="center" gap="xs" className="rec-rating text-gray-40 transition-colors">
        <Star />
        <Text as="span" size="sm" variant="inherit">{rowRating(item).toFixed(1)}</Text>
      </Flex>
    </Flex>
  </Container>
  );
};

const CoverageFootnote = ({ coverage }: { coverage?: Props['coverage'] }) => {
  if (!coverage || coverage.total <= coverage.audited) return null;
  return (
    <Text as="span" size="sm" variant="muted">
      Audited {coverage.audited} of {coverage.total} posts ({coverage.skipped} skipped)
    </Text>
  );
};

const SectionShell = ({ children, listItems }: { children?: React.ReactNode; listItems?: React.ReactNode[] }) => {
  if (listItems) {
    return <ListWidget title="Recommendations" items={listItems} />;
  }
  return (
    <KoalaPanel noPadding>
      <KoalaPanelHeader title="Recommendations" />
      {children}
    </KoalaPanel>
  );
};

const RecommendationsSection = ({
  items, total, faviconDomain, viewHref, loading, pipeline, coverage, hasBlogPath, settingsHref,
}: Props) => {
  // While the domain pipeline runs, the section shows its progress in place of the rows.
  if (pipeline) {
    return <SectionShell><Container padding="2xl">{pipeline}</Container></SectionShell>;
  }
  if (loading) {
    return (
      <SectionShell>
        <RowSkeleton />
        <RowSkeleton divider />
        <Container padding="xl"><Skeleton width={150} height={13} /></Container>
      </SectionShell>
    );
  }
  if (items.length === 0) {
    // No blog path configured ⇒ nothing has been audited; prompt the user to set one.
    if (hasBlogPath === false) {
      return (
        <SectionShell>
          <Flex direction="column" align="center" gap="lg" paddingTop="3xl" paddingBottom="3xl" paddingLeft="2xl" paddingRight="2xl" className="text-center">
            <BoltIcon />
            <Text as="span" size="lg" bold>Set your blog path to start auditing your content</Text>
            <Text as="span" size="md" variant="muted" className="max-w-[420px] leading-relaxed">
              Tell us where your blog lives and we&apos;ll audit each post and surface the ones that need work.
            </Text>
            {settingsHref && (
              <Container as="a" href={settingsHref} className="no-underline">
                <Text as="span" size="sm" bold style={{ color: 'var(--koala-brand)' }}>Go to domain settings</Text>
              </Container>
            )}
          </Flex>
        </SectionShell>
      );
    }
    return (
      <SectionShell>
        <Flex direction="column" align="center" gap="lg" paddingTop="3xl" paddingBottom="3xl" paddingLeft="2xl" paddingRight="2xl" className="text-center">
          <CheckCircle />
          <Text as="span" size="lg" bold>Your domain looks healthy</Text>
          <Text as="span" size="md" variant="muted" className="max-w-[420px] leading-relaxed">
            The scan finished and found no pages that need optimization right now. As your content changes, new opportunities will show up here.
          </Text>
          <CoverageFootnote coverage={coverage} />
        </Flex>
      </SectionShell>
    );
  }
  // Flat list of recommendation rows (optimize → score-gauge, create → priority-pill),
  // pre-sorted by the dashboard (most urgent first), then a "View all" link.
  const listItems = items.map((item, i) => (
    <Row key={item.id} item={item} faviconDomain={faviconDomain} divider={i > 0} />
  ));
  listItems.push(
    <Flex key="footer" align="center" justify="between" gap="md" wrap="wrap" style={{ width: '100%', paddingTop: 8 }}>
      <CoverageFootnote coverage={coverage} />
      <Container as="a" href={viewHref} className="dashboard-rec-view ml-auto no-underline" display="flex" alignItems="center" gap="xs">
        <Text as="span" size="sm" bold variant="muted">View {total} {total === 1 ? 'Recommendation' : 'Recommendations'}</Text>
        <Chevron />
      </Container>
    </Flex>,
  );
  return <SectionShell listItems={listItems} />;
};

export default RecommendationsSection;
