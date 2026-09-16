import React, { useMemo, useState } from 'react';
import { tickRingTicks, type TickRingSegment } from '@/src/core/domain/siteAudit/tickRing';
import { Icon } from '../icons/Icon';

export type TickRingWidgetProps = {
  title: string;
  /** Leading icon name (Phosphor). */
  icon?: string;
  /** "To learn about X, go to Documentation" — the link target. */
  docHref?: string;
  docLabel?: string;
  /** Big number in the ring. */
  value: string;
  /** Small word under the number ("Score", "Link"). */
  caption?: string;
  segments: TickRingSegment[];
  /** Per-segment right-hand value; defaults to the raw value. */
  formatValue?: (s: TickRingSegment) => string;
  badge?: React.ReactNode;
  /** Under the legend: a delta chip, links. */
  footer?: React.ReactNode;
  emptyLabel?: string;
  ticks?: number;
  className?: string;
};

const SIZE = 150;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 72;
const R_INNER = 58;

/**
 * Koala tick-ring comparison — a ring of short strokes coloured by share, the total in
 * the middle, the breakdown as a legend beside it. Site Health and AI Search Health.
 */
export function TickRingWidget({
  title, icon = 'File', docHref, docLabel = 'Documentation', value, caption, segments, formatValue,
  badge, footer, emptyLabel = 'No data yet.', ticks = 60, className,
}: TickRingWidgetProps) {
  const ring = useMemo(() => tickRingTicks(segments, ticks), [segments, ticks]);
  const hasData = segments.some((s) => s.value > 0);
  const [hovered, setHovered] = useState<string | null>(null);
  const dim = (id: string | null | undefined) => (hovered && id !== hovered ? 0.18 : 1);

  return (
    <div className={`tick-ring${className ? ` ${className}` : ''}`}>
      <div className="tick-ring__head">
        <span className="tick-ring__icon"><Icon name={icon} size={18} /></span>
        <h2 className="tick-ring__title">{title}</h2>
        {badge}
        {docHref ? (
          <a className="tick-ring__more" href={docHref} target="_blank" rel="noreferrer" aria-label={docLabel}>
            <Icon name="DotsThree" size={20} />
          </a>
        ) : null}
      </div>
      {docHref ? (
        <p className="tick-ring__sub">
          To learn about {title.toLowerCase()}, go to{' '}
          <a href={docHref} target="_blank" rel="noreferrer">{docLabel}</a>
        </p>
      ) : null}

      <div className="tick-ring__body">
        <div className="tick-ring__chart" role="img" aria-label={`${title}: ${value}${caption ? ` ${caption}` : ''}`}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
            {ring.map((t) => {
              const a = ((t.angle - 90) * Math.PI) / 180;
              const x1 = CX + Math.cos(a) * R_INNER;
              const y1 = CY + Math.sin(a) * R_INNER;
              const x2 = CX + Math.cos(a) * R_OUTER;
              const y2 = CY + Math.sin(a) * R_OUTER;
              return (
                <line
                  key={t.index}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={t.color ?? 'var(--koala-border-primary)'}
                  strokeWidth={4}
                  strokeLinecap="round"
                  opacity={dim(t.segmentId)}
                  style={{ transition: 'opacity 120ms ease' }}
                />
              );
            })}
          </svg>
          <div className="tick-ring__center">
            <span className="tick-ring__value">{value}</span>
            {caption ? <span className="tick-ring__caption">{caption}</span> : null}
          </div>
        </div>

        {hasData ? (
          <ul className="tick-ring__legend" onMouseLeave={() => setHovered(null)}>
            {segments.map((s) => (
              <li
                key={s.id}
                className="tick-ring__row"
                style={{ opacity: dim(s.id), transition: 'opacity 120ms ease' }}
                onMouseEnter={() => setHovered(s.id)}
              >
                <span className="tick-ring__dot" style={{ background: s.color }} aria-hidden="true" />
                <span className="tick-ring__label">{s.label}</span>
                <span className="tick-ring__count">{formatValue ? formatValue(s) : s.value.toLocaleString('en-US')}</span>
              </li>
            ))}
          </ul>
        ) : <p className="tick-ring__empty">{emptyLabel}</p>}
      </div>

      {footer ? <div className="tick-ring__footer">{footer}</div> : null}
    </div>
  );
}

export default TickRingWidget;
