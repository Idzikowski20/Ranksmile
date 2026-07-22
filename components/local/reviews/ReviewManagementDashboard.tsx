import React, { useEffect, useMemo, useState } from 'react';
import Button from '../../core/button/button';
import { Modal, ModalBody } from '../../core/modal/modal';
import Textarea from '../../core/textarea';
import {
  IconChat,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconInfo,
  IconReload,
  IconRobot,
  IconSparkle,
  IconStarFilled,
  IconStarOutline,
  IconTrash,
} from '../icons';
import {
  DEFAULT_AI_REPLIES_UI,
  LANGUAGE_OPTIONS,
  SCOPE_OPTIONS,
  STAR_COLORS,
  STAR_LEGEND,
  TONE_OPTIONS,
  averageRating,
  filterReviews,
  progressYMax,
  ratingDistribution,
  type AiRepliesUiState,
  type RatingFilter,
  type ReplyFilter,
  type ReplyTone,
  type ReviewItem,
  type ReviewProgressMonth,
} from '../../../lib/local/reviewsData';
import type { AiRepliesSettings, BusinessDetails } from '../../../lib/local/types';
import { formatReviewDateLabel } from '../../../lib/local/googleReviews';

type TabId = 'reviews' | 'competitors';

type ReviewManagementDashboardProps = {
  business: BusinessDetails;
  aiRepliesSettings?: AiRepliesSettings;
  gbpAccountId: string;
  gbpLocationId: string;
  reviews: ReviewItem[];
  totalReviews: number;
  averageStarRating: number;
  progress: ReviewProgressMonth[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
};

function toneFromSetup(tone: string | undefined): ReplyTone {
  const t = (tone || '').toLowerCase();
  if (t === 'friendly') return 'FRIENDLY';
  if (t === 'casual') return 'CASUAL';
  return 'PROFESSIONAL';
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="local-reviews-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) =>
        n <= rating ? (
          <IconStarFilled key={n} size={16} color="#F5C518" />
        ) : (
          <IconStarOutline key={n} size={16} color="#F5C518" />
        ),
      )}
    </div>
  );
}

function ReviewProgressChart({ months }: { months: ReviewProgressMonth[] }) {
  const yMax = progressYMax(months);
  const width = 656;
  const height = 188;
  const padL = 40;
  const padT = 10;
  const padB = 40;
  const chartH = height - padT - padB;
  const chartW = width - padL;
  const barW = 13.5;
  const slot = chartW / months.length;
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  const stackKeys: (keyof typeof STAR_COLORS)[] = [
    'noRating',
    'stars1',
    'stars2',
    'stars3',
    'stars4',
    'stars5',
  ];

  return (
    <svg className="local-reviews-progress-svg" width="100%" viewBox={`0 0 ${width} ${height}`} aria-label="Review progress chart">
      {yTicks.map((v) => {
        const y = padT + chartH - (v / yMax) * chartH;
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={width} y2={y} className="local-reviews-axis-grid" />
            <text x={padL - 8} y={y + 4} className="local-reviews-axis-tick" textAnchor="end">
              {v % 1 === 0 ? v : v.toFixed(1)}
            </text>
          </g>
        );
      })}
      <line x1={padL} y1={padT + chartH} x2={width} y2={padT + chartH} className="local-reviews-axis-line" />
      {months.map((m, i) => {
        const xCenter = padL + slot * i + slot / 2;
        const x = xCenter - barW / 2;
        let yCursor = padT + chartH;
        const segments: { key: keyof typeof STAR_COLORS; y: number; h: number; color: string }[] = [];
        for (const key of stackKeys) {
          const count = m[key];
          if (count <= 0) continue;
          const h = (count / yMax) * chartH;
          yCursor -= h;
          segments.push({ key, y: yCursor, h, color: STAR_COLORS[key] });
        }

        return (
          <g key={`${m.label}-${i}`}>
            {segments.map((s) => (
              <rect
                key={s.key}
                x={x}
                y={s.y}
                width={barW}
                height={s.h}
                rx={2}
                fill={s.color}
              />
            ))}
            <text x={xCenter} y={padT + chartH + 18} className="local-reviews-axis-tick" textAnchor="middle">
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RatingDonut({ reviews, average }: { reviews: ReviewItem[]; average?: number }) {
  const avg = average && average > 0 ? average : averageRating(reviews);
  const dist = ratingDistribution(reviews);
  const total = Math.max(reviews.length, 1);
  const r = 60;
  const R = 90;

  const segments = [
    { rating: 4 as const, value: dist[4], color: STAR_COLORS.stars4 },
    { rating: 5 as const, value: dist[5], color: STAR_COLORS.stars5 },
  ].filter((s) => s.value > 0);

  // Half-donut anchored at bottom center; π → 2π sweeps through top (negative Y).
  let angle = Math.PI;
  const arcs = segments.map((s) => {
    const sweep = (s.value / total) * Math.PI;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const large = sweep > Math.PI ? 1 : 0;
    const x0 = R * Math.cos(start);
    const y0 = R * Math.sin(start);
    const x1 = R * Math.cos(end);
    const y1 = R * Math.sin(end);
    const xi0 = r * Math.cos(end);
    const yi0 = r * Math.sin(end);
    const xi1 = r * Math.cos(start);
    const yi1 = r * Math.sin(start);
    const d = [
      `M ${x0} ${y0}`,
      `A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`,
      `L ${xi0} ${yi0}`,
      `A ${r} ${r} 0 ${large} 0 ${xi1} ${yi1}`,
      'Z',
    ].join(' ');
    return { rating: s.rating, d, color: s.color };
  });

  return (
    <div className="local-reviews-donut">
      <svg width="200" height="100" viewBox="0 0 200 100" aria-label="Average star rating">
        <g transform="translate(100,100)">
          {arcs.map((a) => (
            <path key={a.rating} d={a.d} fill={a.color} />
          ))}
        </g>
      </svg>
      <div className="local-reviews-donut-label">
        <span className="local-reviews-donut-value">{avg.toFixed(1)}</span>
        <span className="local-reviews-donut-sub">Avg. star rating</span>
      </div>
    </div>
  );
}

function LinkSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <label className="local-reviews-link-select">
      <span className="local-reviews-link-select-value">
        {current}
        <IconChevronDown size={16} />
      </span>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export default function ReviewManagementDashboard({
  business,
  aiRepliesSettings,
  gbpAccountId,
  gbpLocationId,
  reviews: importedReviews,
  totalReviews,
  averageStarRating,
  progress,
  loading = false,
  error = null,
  onRefresh,
}: ReviewManagementDashboardProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>(importedReviews);
  const avg = averageStarRating > 0 ? averageStarRating : averageRating(reviews);
  const repliedCount = reviews.filter((r) => !!r.reply).length;
  const notRepliedCount = reviews.filter((r) => !r.reply).length;
  const timeSavedMinutes = repliedCount * 3;

  const [tab, setTab] = useState<TabId>('reviews');
  const [ai, setAi] = useState<AiRepliesUiState>(() => ({
    ...DEFAULT_AI_REPLIES_UI,
    enabled: !(aiRepliesSettings?.skipped),
    language: aiRepliesSettings?.language || DEFAULT_AI_REPLIES_UI.language,
    tone: toneFromSetup(aiRepliesSettings?.tone),
    repliedCount,
    repliedDelta: 0,
    timeSavedMinutes,
    timeSavedDeltaMinutes: 0,
    scope:
      aiRepliesSettings?.positiveEnabled && !aiRepliesSettings?.negativeEnabled
        ? 'onPositive'
        : aiRepliesSettings?.negativeEnabled && !aiRepliesSettings?.positiveEnabled
          ? 'onNegative'
          : 'onAll',
  }));
  const [onlyAi, setOnlyAi] = useState(false);
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>('');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [showHow, setShowHow] = useState(false);
  const [expandedTextIds, setExpandedTextIds] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setReviews(importedReviews);
    setEditingId(null);
    setDeleteId(null);
  }, [importedReviews]);

  useEffect(() => {
    setAi((s) => ({
      ...s,
      repliedCount,
      timeSavedMinutes,
    }));
  }, [repliedCount, timeSavedMinutes]);

  // Expand every review that already has a Google owner reply (on import).
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const review of importedReviews) {
      if (review.reply) next[review.id] = true;
    }
    setExpandedIds(next);
  }, [importedReviews]);

  const filtered = useMemo(
    () => filterReviews(reviews, { onlyAi, replyFilter, ratingFilter }),
    [reviews, onlyAi, replyFilter, ratingFilter],
  );

  const progressMonths = progress.length > 0 ? progress : [];
  const deleteTarget = deleteId ? reviews.find((r) => r.id === deleteId) : null;

  const startEdit = (review: ReviewItem) => {
    if (!review.reply) return;
    setEditingId(review.id);
    setEditDraft(review.reply.text);
    setEditError(null);
    setExpandedIds((prev) => ({ ...prev, [review.id]: true }));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
    setEditError(null);
    setSaving(false);
  };

  const saveEdit = async (reviewId: string) => {
    const nextText = editDraft.trim();
    if (!nextText || saving) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch('/api/local/reviews/reply', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: gbpAccountId,
          locationId: gbpLocationId,
          reviewId,
          comment: nextText,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; comment?: string; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      const savedText = data.comment || nextText;
      setReviews((prev) =>
        prev.map((r) => {
          if (r.id !== reviewId || !r.reply) return r;
          return {
            ...r,
            reply: {
              ...r.reply,
              text: savedText,
              dateLabel: formatReviewDateLabel(new Date()),
            },
          };
        }),
      );
      cancelEdit();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save reply to Google');
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/local/reviews/reply', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: gbpAccountId,
          locationId: gbpLocationId,
          reviewId: deleteId,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Delete failed (${res.status})`);
      }
      setReviews((prev) =>
        prev.map((r) => {
          if (r.id !== deleteId) return r;
          return { ...r, reply: null, repliedByAi: false };
        }),
      );
      setExpandedIds((prev) => {
        const next = { ...prev };
        delete next[deleteId];
        return next;
      });
      if (editingId === deleteId) cancelEdit();
      setDeleteId(null);
      setDeleting(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete reply on Google');
      setDeleting(false);
    }
  };

  return (
    <div className="local-reviews">
      {(loading || error) && (
        <div className={`local-reviews-banner${error ? ' is-error' : ''}`}>
          <span>
            {loading
              ? 'Loading Google Business Profile reviews…'
              : `Could not load reviews: ${error}`}
          </span>
          {!loading && onRefresh && (
            <button type="button" className="local-reviews-banner-btn" onClick={onRefresh}>
              <IconReload size={14} />
              Retry
            </button>
          )}
        </div>
      )}

      <div className="local-reviews-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'reviews'}
          className={`local-reviews-tab${tab === 'reviews' ? ' is-active' : ''}`}
          onClick={() => setTab('reviews')}
        >
          Reviews
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'competitors'}
          className={`local-reviews-tab${tab === 'competitors' ? ' is-active' : ''}`}
          onClick={() => setTab('competitors')}
        >
          Competitors
        </button>
      </div>

      {tab === 'competitors' ? (
        <div className="local-reviews-empty-tab">
          <h2>Competitor review analytics</h2>
          <p>
            Compare your rating velocity and reply rate against nearby competitors.
            This view will light up once competitor tracking is connected.
          </p>
        </div>
      ) : (
        <div className="local-reviews-stack">
          <div className="local-reviews-detail-row">
            <section className="local-reviews-panel local-reviews-progress" aria-label="Review Progress">
              <header className="local-reviews-panel-header">
                <h3>Review Progress</h3>
              </header>
              <div className="local-reviews-panel-body">
                <div className="local-reviews-legend">
                  {STAR_LEGEND.map((item) => (
                    <div key={item.key} className="local-reviews-legend-item">
                      <span
                        className="local-reviews-legend-bullet"
                        style={{ background: STAR_COLORS[item.key] }}
                      />
                      {item.label}
                    </div>
                  ))}
                </div>
                {progressMonths.length > 0 ? (
                  <ReviewProgressChart months={progressMonths} />
                ) : (
                  <div className="local-reviews-chart-empty">
                    {loading ? 'Loading chart…' : 'No review activity in the last 13 months.'}
                  </div>
                )}
              </div>
            </section>

            <div className="local-reviews-side">
              <section className="local-reviews-panel local-reviews-stat" aria-label="Total Reviews">
                <header className="local-reviews-panel-header">
                  <h3>Total Reviews</h3>
                </header>
                <div className="local-reviews-panel-body">
                  <div className="local-reviews-stat-value" aria-label={`${totalReviews} reviews in total`}>
                    {loading && totalReviews === 0 ? '—' : totalReviews}
                  </div>
                </div>
              </section>
              <section className="local-reviews-panel local-reviews-avg" aria-label="Average Star Rating">
                <header className="local-reviews-panel-header">
                  <h3>Average Star Rating</h3>
                </header>
                <div className="local-reviews-panel-body">
                  {reviews.length > 0 ? (
                    <RatingDonut reviews={reviews} average={avg} />
                  ) : (
                    <div className="local-reviews-stat-value">
                      {loading ? '—' : avg > 0 ? avg.toFixed(1) : '—'}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          <section className="local-reviews-panel local-reviews-ai">
            <header className="local-reviews-panel-header local-reviews-ai-header">
              <div className="local-reviews-ai-title">
                <h3>AI Replies</h3>
                <IconSparkle size={14} color="#6A6772" />
              </div>
              <button
                type="button"
                className="local-reviews-how"
                onClick={() => setShowHow((v) => !v)}
              >
                How it works
              </button>
            </header>
            <div className="local-reviews-panel-body local-reviews-ai-body">
              {showHow && (
                <p className="local-reviews-how-copy">
                  When enabled, new Google reviews for {business.name} matching your scope
                  are answered automatically in the selected language and tone.
                  You can edit or delete any reply from the thread.
                </p>
              )}
              <div className="local-reviews-ai-controls">
                <label className={`local-reviews-switch${ai.enabled ? ' is-on' : ''}`}>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={ai.enabled}
                    aria-label="Enable AI Replies"
                    onChange={(e) => setAi((s) => ({ ...s, enabled: e.target.checked }))}
                  />
                  <span className="local-reviews-switch-track" />
                </label>
                <div className="local-reviews-ai-sentence">
                  <span>Auto-reply to</span>
                  <LinkSelect
                    ariaLabel="Reply scope"
                    value={ai.scope}
                    options={SCOPE_OPTIONS}
                    onChange={(scope) => setAi((s) => ({ ...s, scope }))}
                  />
                  <span>in</span>
                  <LinkSelect
                    ariaLabel="Reply language"
                    value={ai.language}
                    options={LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l }))}
                    onChange={(language) => setAi((s) => ({ ...s, language }))}
                  />
                  <span>with a</span>
                  <LinkSelect
                    ariaLabel="Reply tone"
                    value={ai.tone}
                    options={TONE_OPTIONS}
                    onChange={(tone) => setAi((s) => ({ ...s, tone }))}
                  />
                  <span>tone</span>
                </div>
              </div>
              <div className="local-reviews-metrics">
                <div className="local-reviews-metric">
                  <div className="local-reviews-metric-label">
                    Replied
                    <span className="local-reviews-metric-hint" title="Reviews answered by AI in the last 30 days">
                      <IconInfo size={16} color="#6A6772" />
                    </span>
                  </div>
                  <div className="local-reviews-metric-value">
                    <strong>{ai.repliedCount} reviews</strong>
                    {ai.repliedDelta > 0 && (
                      <span className="local-reviews-metric-delta">↑+{ai.repliedDelta}</span>
                    )}
                  </div>
                </div>
                <div className="local-reviews-metric">
                  <div className="local-reviews-metric-label">
                    Time Saved
                    <span className="local-reviews-metric-hint" title="Estimated time saved vs manual replies (~3 min each)">
                      <IconInfo size={16} color="#6A6772" />
                    </span>
                  </div>
                  <div className="local-reviews-metric-value">
                    <strong>{ai.timeSavedMinutes}m</strong>
                    {ai.timeSavedDeltaMinutes > 0 && (
                      <span className="local-reviews-metric-delta">↑+{ai.timeSavedDeltaMinutes}m</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="local-reviews-panel local-reviews-list-panel" aria-label="Reviews">
            <header className="local-reviews-list-header">
              <h3>Reviews</h3>
              <span className="local-reviews-list-count">({totalReviews || reviews.length})</span>
              {avg > 0 && (
                <span className="local-reviews-list-avg">
                  <IconStarFilled size={16} color="#2FC26E" />
                  {avg.toFixed(1).replace('.', ',')}
                </span>
              )}
              <div className="local-reviews-list-spacer" />
              {onRefresh && (
                <button
                  type="button"
                  className="local-reviews-refresh"
                  onClick={onRefresh}
                  disabled={loading}
                  aria-label="Refresh reviews"
                >
                  <IconReload size={14} />
                  Refresh
                </button>
              )}
              <div className="local-reviews-list-filters">
                <label className={`local-reviews-filter-switch${onlyAi ? ' is-on' : ''}`}>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={onlyAi}
                    aria-label="Show only replied by AI reviews"
                    onChange={(e) => setOnlyAi(e.target.checked)}
                  />
                  <span className="local-reviews-switch-track is-sm" />
                  <span>Only replied by AI</span>
                </label>
                <div className="local-reviews-pills" role="radiogroup" aria-label="Review types">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={replyFilter === ''}
                    className={`local-reviews-pill${replyFilter === '' ? ' is-selected' : ''}`}
                    onClick={() => setReplyFilter('')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={replyFilter === 'not_replied'}
                    className={`local-reviews-pill${replyFilter === 'not_replied' ? ' is-selected' : ''}`}
                    onClick={() => setReplyFilter('not_replied')}
                  >
                    Not Replied
                    <span className="local-reviews-pill-count">{notRepliedCount}</span>
                  </button>
                </div>
                <label className="local-reviews-rating-select">
                  <IconChat size={16} color="#6A6772" />
                  <select
                    aria-label="Select rating"
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value as RatingFilter)}
                  >
                    <option value="">Any rating</option>
                    <option value="5">5 stars</option>
                    <option value="4">4 stars</option>
                    <option value="3">3 stars</option>
                    <option value="2">2 stars</option>
                    <option value="1">1 star</option>
                  </select>
                  <IconChevronDown size={16} color="#6A6772" />
                </label>
              </div>
            </header>

            <ul className="local-reviews-list">
              {!loading && filtered.length === 0 && (
                <li className="local-reviews-empty-row">
                  {error
                    ? 'Import failed — try Refresh.'
                    : reviews.length === 0
                      ? 'No Google reviews found for this location yet.'
                      : 'No reviews match these filters.'}
                </li>
              )}
              {loading && reviews.length === 0 && (
                <li className="local-reviews-empty-row">Loading reviews from Google…</li>
              )}
              {filtered.map((review, index) => {
                const isOpen = !!expandedIds[review.id];
                const showFull = !!expandedTextIds[review.id];
                const displayText = showFull && review.textFull ? review.textFull : review.text;
                const canExpandText = !!review.textFull && review.textFull !== review.text;

                return (
                  <li key={review.id}>
                    <article
                      className={`local-reviews-item${index === 0 ? ' is-first' : ''}${index === filtered.length - 1 ? ' is-last' : ''}${isOpen ? ' is-active' : ''}`}
                      id={`review-${review.id}`}
                    >
                      <div className="local-reviews-item-inner">
                        <div className="local-reviews-item-head">
                          <img
                            className="local-reviews-google"
                            src="https://www.google.com/favicon.ico"
                            width={24}
                            height={24}
                            alt=""
                          />
                          <h4 className="local-reviews-author">{review.author}</h4>
                          <StarRow rating={review.rating} />
                          <span className="local-reviews-date">{review.dateLabel}</span>
                        </div>

                        <div className="local-reviews-item-body">
                          {displayText ? (
                            <div className="local-reviews-text">
                              {displayText.split('\n').map((line, i) => (
                                <React.Fragment key={i}>
                                  {i > 0 && <br />}
                                  {line}
                                </React.Fragment>
                              ))}
                              {canExpandText && (
                                <button
                                  type="button"
                                  className="local-reviews-more"
                                  onClick={() =>
                                    setExpandedTextIds((prev) => ({
                                      ...prev,
                                      [review.id]: !prev[review.id],
                                    }))
                                  }
                                >
                                  {showFull ? 'Less' : 'More'}
                                </button>
                              )}
                            </div>
                          ) : null}

                          <div className="local-reviews-item-actions">
                            {review.reply && (
                              <div className="local-reviews-reply-count">
                                {review.repliedByAi ? (
                                  <IconRobot size={16} color="#6A6772" />
                                ) : (
                                  <IconChat size={16} color="#6A6772" />
                                )}
                                <span>1</span>
                              </div>
                            )}
                            {review.reply ? (
                              <button
                                type="button"
                                className="local-reviews-thread-link"
                                onClick={() =>
                                  setExpandedIds((prev) => ({
                                    ...prev,
                                    [review.id]: !prev[review.id],
                                  }))
                                }
                              >
                                {isOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                                {isOpen ? 'Hide reply' : 'Show thread and reply'}
                              </button>
                            ) : (
                              <button type="button" className="local-reviews-thread-link" disabled>
                                <IconChevronRight size={16} />
                                Reply
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {isOpen && review.reply && (
                        <div className="local-reviews-thread">
                          <div className={`local-reviews-comment${editingId === review.id ? ' is-editing' : ''}`}>
                            {editingId === review.id ? (
                              <>
                                <div className="local-reviews-edit-meta">
                                  {review.reply.author}
                                  {review.reply.dateLabel ? ` ${review.reply.dateLabel}` : ''}
                                </div>
                                <Textarea
                                  value={editDraft}
                                  onChange={(e) => setEditDraft(e.target.value)}
                                  rows={6}
                                  resize="vertical"
                                  aria-label="Edit reply"
                                  className="local-reviews-edit-textarea"
                                  disabled={saving}
                                />
                                {editError && (
                                  <p className="local-reviews-edit-error" role="alert">{editError}</p>
                                )}
                                <div className="local-reviews-edit-actions">
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    busy={saving}
                                    disabled={!editDraft.trim() || saving}
                                    onClick={() => { void saveEdit(review.id); }}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={saving}
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="local-reviews-comment-head">
                                  <span className="local-reviews-comment-author">{review.reply.author}</span>
                                  {review.reply.dateLabel && (
                                    <span className="local-reviews-date">{review.reply.dateLabel}</span>
                                  )}
                                  <div className="local-reviews-comment-controls">
                                    <button
                                      type="button"
                                      aria-label="Edit comment"
                                      className="local-reviews-icon-btn"
                                      onClick={() => startEdit(review)}
                                    >
                                      <IconEdit size={16} color="#6A6772" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Delete comment"
                                      className="local-reviews-icon-btn"
                                      onClick={() => {
                                        setDeleteError(null);
                                        setDeleteId(review.id);
                                      }}
                                    >
                                      <IconTrash size={16} color="#6A6772" />
                                    </button>
                                  </div>
                                </div>
                                <p className="local-reviews-comment-body">
                                  {review.reply.text.split('\n').map((line, i) => (
                                    <React.Fragment key={i}>
                                      {i > 0 && <br />}
                                      {line}
                                    </React.Fragment>
                                  ))}
                                </p>
                                {review.reply.source === 'ai' && (
                                  <div className="local-reviews-comment-footer">
                                    <IconRobot size={16} color="#6A6772" />
                                    Replied by AI
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      {deleteTarget && (
        <Modal
          title="Do you want to delete this comment?"
          onClose={() => {
            if (!deleting) {
              setDeleteId(null);
              setDeleteError(null);
            }
          }}
          width={480}
        >
          <ModalBody>
            <p className="local-reviews-delete-copy">This action cannot be undone.</p>
            {deleteError && (
              <p className="local-reviews-edit-error" role="alert">{deleteError}</p>
            )}
          </ModalBody>
          <div className="local-reviews-delete-footer">
            <Button
              type="button"
              variant="danger"
              size="md"
              busy={deleting}
              disabled={deleting}
              onClick={() => { void confirmDelete(); }}
            >
              Delete comment
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={deleting}
              onClick={() => {
                setDeleteId(null);
                setDeleteError(null);
              }}
            >
              Don&apos;t delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
