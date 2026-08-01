import React from 'react';
import { createPortal } from 'react-dom';
import { CrawlLimitBody, WarningIcon } from './crawlLimitContent';
import { useAnchorDismiss } from './useAnchorDismiss';

type Props = {
  anchorRect: DOMRect | null;
  onClose: () => void;
  pagesCrawled: number;
  pagesLimit: number;
  upgradePlanName: string | null;
  upgradePlanSlug: string | null;
  upgradePagesLimit: number | null;
};

export default function CrawlLimitPopover({
  anchorRect,
  onClose,
  pagesCrawled,
  pagesLimit,
  upgradePlanName,
  upgradePlanSlug,
  upgradePagesLimit,
}: Props) {
  const ref = useAnchorDismiss(onClose);
  if (!anchorRect || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Page crawl limit"
      className="koala-crawl-limit-popover"
      style={{
        position: 'fixed',
        top: anchorRect.bottom + 8,
        left: Math.max(8, anchorRect.left - 120),
        width: 420,
        maxWidth: 'calc(100vw - 16px)',
        zIndex: 300,
      }}
    >
      <CrawlLimitBody
        pagesCrawled={pagesCrawled}
        pagesLimit={pagesLimit}
        upgradePlanName={upgradePlanName}
        upgradePlanSlug={upgradePlanSlug}
        upgradePagesLimit={upgradePagesLimit}
        variant="popover"
        onClose={onClose}
      />
    </div>,
    document.body,
  );
}

type IndicatorProps = {
  pagesCrawled: number;
  pagesLimit: number;
  atCrawlLimit: boolean;
  canUpgradeCrawlLimit: boolean;
  upgradePlanName: string | null;
  upgradePlanSlug: string | null;
  upgradePagesLimit: number | null;
};

export function CrawlLimitIndicator({
  pagesCrawled,
  pagesLimit,
  atCrawlLimit,
  canUpgradeCrawlLimit,
  upgradePlanName,
  upgradePlanSlug,
  upgradePagesLimit,
}: IndicatorProps) {
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  const showWarning = atCrawlLimit;
  const clickable = showWarning && canUpgradeCrawlLimit;

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!clickable) return;
    const r = e.currentTarget.getBoundingClientRect();
    setRect(r);
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        type="button"
        className={`koala-crawl-limit-indicator ${showWarning ? 'koala-crawl-limit-indicator--warn' : ''} ${clickable ? 'koala-crawl-limit-indicator--clickable' : ''}`}
        onClick={onClick}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={!clickable}
      >
        <span>Pages crawled:</span>
        {showWarning && <WarningIcon />}
        <strong>{pagesCrawled}</strong>
        <span>
          /
          {pagesLimit}
        </span>
      </button>
      {open && (
        <CrawlLimitPopover
          anchorRect={rect}
          onClose={() => setOpen(false)}
          pagesCrawled={pagesCrawled}
          pagesLimit={pagesLimit}
          upgradePlanName={upgradePlanName}
          upgradePlanSlug={upgradePlanSlug}
          upgradePagesLimit={upgradePagesLimit}
        />
      )}
    </>
  );
}
