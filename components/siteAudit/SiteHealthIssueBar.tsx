import React from 'react';

export type HealthIssueSegment = {
  id: string;
  label: string;
  count: number;
  color: string;
};

type Props = {
  segments: HealthIssueSegment[];
  onSegmentClick?: (id: string) => void;
};

/**
 * 1Password Watchtower / PasswordStrength-style overlapping pill bar.
 * Segments stack right→left with z-index so rounded caps peek through.
 */
export default function SiteHealthIssueBar({ segments, onSegmentClick }: Props) {
  const positive = segments.filter((s) => s.count > 0);
  const total = positive.reduce((sum, s) => sum + s.count, 0);

  if (!total || positive.length === 0) {
    return <div className="sentry-health-issue-bar sentry-health-issue-bar--empty" aria-hidden="true" />;
  }

  // Fixed quality order (Watchtower / PasswordStrength): best → fair, stacked left.
  const order = ['notices', 'warnings', 'errors', 'healthy', 'haveIssues', 'redirects', 'broken', 'blocked'] as const;
  const ordered = [...positive].sort(
    (a, b) => order.indexOf(a.id as typeof order[number]) - order.indexOf(b.id as typeof order[number]),
  );

  return (
    <div className="sentry-health-issue-bar" role="group" aria-label="Issue severity mix">
      {ordered.map((seg, index) => {
        const pct = (seg.count / total) * 100;
        const z = ordered.length - index;
        return (
          <button
            key={seg.id}
            type="button"
            className="sentry-health-issue-bar-seg"
            aria-label={`${seg.count} ${seg.label}`}
            title={`${seg.label}: ${seg.count}`}
            onClick={onSegmentClick ? () => onSegmentClick(seg.id) : undefined}
            style={{
              width: `calc(${pct.toFixed(4)}% + 1.5rem)`,
              backgroundColor: seg.color,
              zIndex: z,
            }}
          />
        );
      })}
    </div>
  );
}
