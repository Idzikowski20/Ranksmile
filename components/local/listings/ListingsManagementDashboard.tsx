import React, { useMemo, useState } from 'react';
import Button from '../../core/button/button';
import {
  IconCheck,
  IconExport,
  IconExternalLink,
  IconFacebook,
  IconInfo,
  IconReload,
  IconShare,
} from '../icons';
import {
  LISTING_STATUS_META,
  MOCK_DIRECTORY_LISTINGS,
  countListingStatuses,
  listingMatchesFilter,
  sortListingsByStatus,
  type DirectoryListing,
  type ListingStatus,
  type StatusFilterValue,
} from '../../../lib/local/listingsData';
import type { BusinessDetails } from '../../../lib/local/types';

type TabId = 'listings' | 'duplicates' | 'suggestions';

type ListingsManagementDashboardProps = {
  business: BusinessDetails;
};

const STATUS_FILTERS: { value: StatusFilterValue; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'CONNECTED', label: 'Connected' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'DISCONNECTED', label: 'Disconnected' },
  { value: 'UNAVAILABLE', label: 'Unavailable' },
];

function formatPhone(phone: string | undefined): string {
  if (!phone) return '';
  return phone;
}

function ListingStatusTag({ status }: { status: Exclude<ListingStatus, 'needs_connect'> }) {
  const meta = LISTING_STATUS_META[status];
  const Icon =
    status === 'connected' ? IconCheck
      : status === 'submitted' ? IconShare
        : status === 'processing' ? IconReload
          : IconInfo;

  return (
    <span className="local-listings-tag" style={{ '--tag-color': meta.tagColor } as React.CSSProperties}>
      <Icon size={14} color={meta.tagColor} />
      {meta.label}
    </span>
  );
}

function ListingsDonut({
  counts,
}: {
  counts: ReturnType<typeof countListingStatuses>;
}) {
  const segments: { key: keyof typeof LISTING_STATUS_META; value: number }[] = [
    { key: 'connected', value: counts.connected },
    { key: 'submitted', value: counts.submitted },
    { key: 'processing', value: counts.processing },
    { key: 'disconnected', value: counts.disconnected },
    { key: 'unavailable', value: counts.unavailable },
  ];

  const total = Math.max(counts.total, 1);
  const r = 40;
  const R = 60;
  const cx = 66;
  const cy = 66;

  let angle = -Math.PI / 2;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const sweep = (s.value / total) * Math.PI * 2;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      const large = sweep > Math.PI ? 1 : 0;
      const x0 = cx + R * Math.cos(start);
      const y0 = cy + R * Math.sin(start);
      const x1 = cx + R * Math.cos(end);
      const y1 = cy + R * Math.sin(end);
      const xi0 = cx + r * Math.cos(end);
      const yi0 = cy + r * Math.sin(end);
      const xi1 = cx + r * Math.cos(start);
      const yi1 = cy + r * Math.sin(start);
      const d = [
        `M ${x0} ${y0}`,
        `A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`,
        `L ${xi0} ${yi0}`,
        `A ${r} ${r} 0 ${large} 0 ${xi1} ${yi1}`,
        'Z',
      ].join(' ');
      return { key: s.key, d, color: LISTING_STATUS_META[s.key].legendColor };
    });

  const legend = [
    { key: 'connected' as const, value: counts.connected },
    { key: 'submitted' as const, value: counts.submitted },
    { key: 'processing' as const, value: counts.processing, label: 'Processing' },
    { key: 'disconnected' as const, value: counts.disconnected },
    { key: 'unavailable' as const, value: counts.unavailable },
  ];

  return (
    <div className="local-listings-counters">
      <div className="local-listings-donut-wrap">
        <svg width="132" height="132" viewBox="0 0 132 132" aria-label="Listings status chart">
          {arcs.length === 0 ? (
            <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke="#DAD9DE" strokeWidth={R - r} />
          ) : (
            arcs.map((a) => <path key={a.key} d={a.d} fill={a.color} />)
          )}
        </svg>
        <div className="local-listings-donut-center">
          <div className="local-listings-donut-total">{counts.total}</div>
          <div className="local-listings-donut-sub">Potential listings</div>
        </div>
      </div>
      <div className="local-listings-legend">
        {legend.map((item) => (
          <div key={item.key} className="local-listings-legend-row">
            <div className="local-listings-legend-label">
              <span
                className="local-listings-legend-bullet"
                style={{ background: LISTING_STATUS_META[item.key].legendColor }}
              />
              <span>{item.label ?? LISTING_STATUS_META[item.key].label}</span>
              <span className="local-listings-legend-hint" title={LISTING_STATUS_META[item.key].label}>
                <IconInfo size={14} color="#A09FAB" />
              </span>
            </div>
            <div className="local-listings-legend-value">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DirectoryCell({ listing }: { listing: DirectoryListing }) {
  return (
    <div className="local-listings-publisher">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={listing.iconUrl} alt="" width={24} height={24} className="local-listings-publisher-icon" />
      <div className="local-listings-publisher-text">
        <div className="local-listings-publisher-name">{listing.name}</div>
        {listing.parentBrand ? (
          <div className="local-listings-publisher-parent">{listing.parentBrand}</div>
        ) : null}
      </div>
    </div>
  );
}

function DetailCell({
  listing,
  business,
}: {
  listing: DirectoryListing;
  business: BusinessDetails;
}) {
  if (listing.status === 'needs_connect' || listing.status === 'processing' || listing.status === 'unavailable') {
    return (
      <div className="local-listings-detail muted">
        {listing.detailMessage ?? '—'}
      </div>
    );
  }

  if (listing.status === 'submitted' || listing.status === 'connected') {
    return (
      <div className="local-listings-detail">
        <div>{business.name}</div>
        <div>{business.address}</div>
        {business.phone ? <div>{formatPhone(business.phone)}</div> : null}
      </div>
    );
  }

  return <div className="local-listings-detail muted">—</div>;
}

function ActionCell({ listing }: { listing: DirectoryListing }) {
  const hasUrl = Boolean(listing.listingUrl);

  return (
    <div className="local-listings-actions">
      {hasUrl ? (
        <a
          className="local-listings-view-link"
          href={listing.listingUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${listing.name} listing in a new tab`}
        >
          View listing
          <IconExternalLink size={14} color="#A09FAB" />
        </a>
      ) : (
        <span className="local-listings-view-link disabled">
          View listing
          <IconExternalLink size={14} color="#DAD9DE" />
        </span>
      )}
      {listing.showOptOut ? (
        <>
          <span className="local-listings-action-divider" />
          <button type="button" className="local-listings-opt-out">
            Opt out
          </button>
        </>
      ) : null}
    </div>
  );
}

export default function ListingsManagementDashboard({ business }: ListingsManagementDashboardProps) {
  const [tab, setTab] = useState<TabId>('listings');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('');
  const [statusAsc, setStatusAsc] = useState(true);
  const [noticeVisible, setNoticeVisible] = useState(true);

  const counts = useMemo(() => countListingStatuses(MOCK_DIRECTORY_LISTINGS), []);

  const rows = useMemo(() => {
    const filtered = MOCK_DIRECTORY_LISTINGS.filter((row) => listingMatchesFilter(row, statusFilter));
    return sortListingsByStatus(filtered, statusAsc);
  }, [statusFilter, statusAsc]);

  const needsFacebook = MOCK_DIRECTORY_LISTINGS.some(
    (row) => row.connectProvider === 'facebook' && row.status === 'needs_connect',
  );

  return (
    <div className="local-listings">
      <div className="local-listings-tabs" role="tablist">
        {(
          [
            { id: 'listings', label: 'Listings' },
            { id: 'duplicates', label: 'Duplicates' },
            { id: 'suggestions', label: 'User Suggestions' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`local-listings-tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'listings' ? (
        <div className="local-listings-stack">
          <div className="local-listings-panel">
            <ListingsDonut counts={counts} />
          </div>

          {noticeVisible && needsFacebook ? (
            <div className="local-listings-notice" role="region" aria-label="Notification">
              <div className="local-listings-notice-text">
                To auto-populate your business data to specific directories, you need to grant access to your pages.
              </div>
              <div className="local-listings-notice-actions">
                <Button type="button" size="sm" variant="primary">
                  <span className="local-listings-btn-inner">
                    <IconFacebook size={14} color="#FFFFFF" />
                    Connect Facebook
                  </span>
                </Button>
                <button
                  type="button"
                  className="local-listings-notice-dismiss"
                  onClick={() => setNoticeVisible(false)}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            </div>
          ) : null}

          <div className="local-listings-panel local-listings-table-panel">
            <div className="local-listings-filters">
              <fieldset className="local-listings-pills">
                <legend className="visually-hidden">Location status</legend>
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value || 'all'}
                    type="button"
                    role="radio"
                    aria-checked={statusFilter === f.value}
                    className={`local-listings-pill${statusFilter === f.value ? ' is-selected' : ''}`}
                    onClick={() => setStatusFilter(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </fieldset>
              <div className="local-listings-filters-spacer" />
              <button type="button" className="local-listings-export" aria-label="Export listing data">
                <IconExport size={16} color="#6A6772" />
              </button>
            </div>

            <div className="local-listings-table-wrap">
              <table className="local-listings-table">
                <thead>
                  <tr>
                    <th style={{ width: 220 }}>Directory</th>
                    <th style={{ width: 150 }}>
                      <button
                        type="button"
                        className="local-listings-sort"
                        onClick={() => setStatusAsc((v) => !v)}
                      >
                        Status
                        <span aria-hidden="true">{statusAsc ? '↑' : '↓'}</span>
                      </button>
                    </th>
                    <th>Name / Address / Phone number</th>
                    <th style={{ width: 180 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((listing) => (
                    <tr key={listing.id}>
                      <td>
                        <DirectoryCell listing={listing} />
                      </td>
                      <td>
                        {listing.status === 'needs_connect' ? (
                          <Button type="button" size="sm" variant="primary">
                            <span className="local-listings-btn-inner">
                              <IconFacebook size={14} color="#FFFFFF" />
                              Connect
                            </span>
                          </Button>
                        ) : (
                          <ListingStatusTag status={listing.status} />
                        )}
                      </td>
                      <td>
                        <DetailCell listing={listing} business={business} />
                      </td>
                      <td>
                        <ActionCell listing={listing} />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="local-listings-empty-row">
                        No listings match this filter.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'duplicates' ? (
        <div className="local-listings-panel local-listings-empty-tab">
          <h2>Duplicates</h2>
          <p>No duplicate listings detected for this location.</p>
        </div>
      ) : null}

      {tab === 'suggestions' ? (
        <div className="local-listings-panel local-listings-empty-tab">
          <h2>User Suggestions</h2>
          <p>No user suggestions yet. Suggested edits from directories will appear here.</p>
        </div>
      ) : null}
    </div>
  );
}
