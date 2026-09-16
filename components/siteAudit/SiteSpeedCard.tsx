import React from 'react';
import type { SiteSpeedSummary } from '@/src/infrastructure/siteAudit/types';
import { formatMetric, speedMarkerPercent, speedVerdict } from '@/src/core/domain/siteAudit/siteSpeed';
import { Icon } from '../koala/icons/Icon';

const DOC_HREF = 'https://developer.chrome.com/docs/lighthouse/performance/performance-scoring';

type Props = {
  speed: SiteSpeedSummary | null;
  enabled: boolean;
};

const METRICS: Array<{ key: keyof SiteSpeedSummary; label: string; kind: 'ms' | 'cls' }> = [
  { key: 'lcpMs', label: 'Load Time', kind: 'ms' },
  { key: 'tbtMs', label: 'Interactivity', kind: 'ms' },
  { key: 'cls', label: 'Visual Stability', kind: 'cls' },
  { key: 'speedIndexMs', label: 'Animation Load', kind: 'ms' },
];

/**
 * Site Speed Score — the Lighthouse performance score for the homepage as a bar from
 * Poor to Great with the four field metrics under it. Measured by PageSpeed Insights as
 * part of a site audit run and shown until the next run.
 */
export default function SiteSpeedCard({ speed, enabled }: Props) {
  const pct = speed ? speedMarkerPercent(speed.score) : 0;

  return (
    <div className="speed-card" data-testid="site-speed-card">
      <div className="tick-ring__head">
        <span className="tick-ring__icon"><Icon name="Lightning" size={18} /></span>
        <h2 className="tick-ring__title">Site Speed Score</h2>
        <a className="tick-ring__more" href={DOC_HREF} target="_blank" rel="noreferrer" aria-label="Documentation">
          <Icon name="DotsThree" size={20} />
        </a>
      </div>

      <div className="speed-card__top">
        <div className="speed-card__score">
          {speed ? <>{speed.score}<small>/100</small></> : <span className="speed-card__score--none">—</span>}
        </div>
        <div className="speed-card__verdict">
          <strong>{speed ? speedVerdict(speed.score) : 'Not measured yet'}</strong>
          <span>
            {speed ? 'To increase your score, go to ' : 'Runs with your next site audit. Learn more in '}
            <a href={DOC_HREF} target="_blank" rel="noreferrer">Documentation</a>
          </span>
        </div>
      </div>

      <div className="speed-card__bar" aria-hidden="true">
        <div className="speed-card__track">
          <div className="speed-card__fill" style={{ width: `${pct}%` }} />
          {[0, 50, 100].map((m) => (
            <span key={m} className="speed-card__mark" style={{ left: `${m}%` }} />
          ))}
          {speed ? (
            <span className="speed-card__handle" style={{ left: `${pct}%` }}>
              <Icon name="DotsSixVertical" size={14} />
            </span>
          ) : null}
        </div>
        <div className="speed-card__scale">
          <span>Poor</span><span>Need Improvement</span><span>Great</span>
        </div>
      </div>

      <dl className="speed-card__metrics">
        {METRICS.map((m) => (
          <div key={m.key} className="speed-card__metric">
            <dt>{m.label}</dt>
            <dd>{formatMetric(speed ? (speed[m.key] as number | null) : null, m.kind)}</dd>
          </div>
        ))}
      </dl>

      <div className="speed-card__actions">
        {!enabled ? (
          <span className="speed-card__note">Set PAGESPEED_API_KEY to enable measurements.</span>
        ) : speed ? (
          <span className="speed-card__note">Measured {new Date(speed.measuredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        ) : (
          <span className="speed-card__note">Runs with your next site audit.</span>
        )}
      </div>
    </div>
  );
}
