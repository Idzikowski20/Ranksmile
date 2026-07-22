/**
 * Shared “creating article” stage — same visual language as /articles/generating.
 * Sizes: lg (wizard), md (panels), sm (bars/strips), xs (list rows).
 */
import React from 'react';

const LINE_WIDTHS = [100, 72, 92, 58, 88, 64, 80, 70, 95, 52] as const;

const SPARK_PATH =
  'M12.93 1.64a1 1 0 0 0-1.86 0L9.05 6.87c-.3.78-.4 1.01-.52 1.19-.13.18-.29.34-.47.47-.18.13-.41.22-1.19.52L1.64 11.07a1 1 0 0 0 0 1.86l5.23 2.01c.78.3 1.01.4 1.19.52.18.13.34.29.47.47.13.18.22.41.52 1.19l2.01 5.23a1 1 0 0 0 1.86 0l2.01-5.23c.3-.78.4-1.01.52-1.19.13-.18.29-.34.47-.47.18-.13.41-.22 1.19-.52l5.23-2.01a1 1 0 0 0 0-1.86l-5.23-2.01c-.78-.3-1.01-.4-1.19-.52a1.5 1.5 0 0 1-.47-.47c-.13-.18-.22-.41-.52-1.19L12.93 1.64Z';

export type GeneratingStageSize = 'lg' | 'md' | 'sm' | 'xs';

export function ArticlePreviewCard({
  lines,
  className,
  delayMs = 0,
}: {
  lines: number;
  className?: string;
  delayMs?: number;
}) {
  return (
    <div
      className={`nc-gen-card ${className || ''}`}
      style={{ animationDelay: `${delayMs}ms` }}
      aria-hidden="true"
    >
      <div className="nc-gen-card-inner">
        <div className="nc-gen-card-title-bar" />
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="nc-gen-card-line"
            style={{
              width: `${LINE_WIDTHS[i % LINE_WIDTHS.length]}%`,
              animationDelay: `${delayMs + 280 + i * 160}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function StageCards({ size }: { size: GeneratingStageSize }) {
  if (size === 'xs') {
    return (
      <div className="nc-gen-stage" aria-hidden="true">
        <ArticlePreviewCard lines={4} className="nc-gen-card--front" delayMs={0} />
        <span className="nc-gen-spark">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={SPARK_PATH} />
          </svg>
        </span>
      </div>
    );
  }

  if (size === 'sm') {
    return (
      <div className="nc-gen-stage" aria-hidden="true">
        <ArticlePreviewCard lines={4} className="nc-gen-card--back-left" delayMs={0} />
        <ArticlePreviewCard lines={5} className="nc-gen-card--front" delayMs={120} />
        <span className="nc-gen-spark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={SPARK_PATH} />
          </svg>
        </span>
      </div>
    );
  }

  return (
    <div className="nc-gen-stage" aria-hidden="true">
      <ArticlePreviewCard lines={5} className="nc-gen-card--back-left" delayMs={0} />
      <ArticlePreviewCard lines={7} className="nc-gen-card--back-right" delayMs={120} />
      <ArticlePreviewCard lines={9} className="nc-gen-card--front" delayMs={200} />
      <span className="nc-gen-spark">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={SPARK_PATH} />
        </svg>
      </span>
    </div>
  );
}

export type GeneratingStageProps = {
  size?: GeneratingStageSize;
  /** Horizontal layout (stage left, copy right) — bars / strips. */
  layout?: 'stack' | 'inline';
  dark?: boolean;
  title?: string;
  status?: string;
  progressPct?: number | null;
  showProgress?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export default function GeneratingStage({
  size = 'lg',
  layout = 'stack',
  dark = false,
  title,
  status,
  progressPct = null,
  showProgress,
  className,
  children,
}: GeneratingStageProps) {
  const pct = progressPct ?? 0;
  const showPct = progressPct != null;
  const withProgress = showProgress ?? (showPct || size === 'lg' || size === 'md');

  return (
    <div
      className={[
        'nc-gen',
        `nc-gen--${size}`,
        layout === 'inline' ? 'nc-gen--inline' : '',
        dark ? 'nc-gen--dark' : '',
        className || '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <StageCards size={size} />

      {(title || status || children) && (
        <div className="nc-gen-copy">
          {title ? <h2 className="nc-gen-title">{title}</h2> : null}
          {status ? (
            <p className="nc-gen-status" aria-live="polite">
              {status}
            </p>
          ) : null}
          {children}
        </div>
      )}

      {withProgress ? (
        <>
          <div
            className="nc-gen-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={showPct ? pct : undefined}
          >
            <div
              className={`nc-gen-progress-fill${showPct ? '' : ' nc-gen-progress-fill--indeterminate'}`}
              style={showPct ? { width: `${pct}%` } : undefined}
            />
          </div>
          {showPct && size !== 'xs' && size !== 'sm' ? (
            <p className="nc-gen-progress-label">{Math.round(pct)}%</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
