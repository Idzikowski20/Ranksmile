import React from 'react';
import { createPortal } from 'react-dom';
import { getCatalogEntry } from '../../lib/siteAudit/issueCatalog';
import type { SiteAuditIssueSummary } from '../../lib/siteAudit/types';
import { useAnchorDismiss } from './useAnchorDismiss';

const FONT = 'var(--font-family-primary)';

type Props = {
  issue: SiteAuditIssueSummary;
  anchorRect: DOMRect | null;
  onClose: () => void;
};

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M12.365 1.264a.385.385 0 0 0-.73 0l-.511 1.553a.48.48 0 0 1-.307.307l-1.553.51a.385.385 0 0 0 0 .731l1.553.511a.48.48 0 0 1 .307.307l.51 1.553a.385.385 0 0 0 .731 0l.511-1.553a.48.48 0 0 1 .307-.307l1.553-.51a.385.385 0 0 0 0-.731l-1.553-.511a.48.48 0 0 1-.307-.307l-.51-1.553ZM6.371 5.269a.39.39 0 0 0-.742 0L4.704 8.08a.977.977 0 0 1-.623.623l-2.812.925a.39.39 0 0 0 0 .742l2.812.925a.977.977 0 0 1 .623.623l.925 2.812a.39.39 0 0 0 .742 0l.925-2.812a.977.977 0 0 1 .623-.623l2.812-.925a.39.39 0 0 0 0-.742L7.92 8.704a.977.977 0 0 1-.623-.623L6.371 5.27Z" />
    </svg>
  );
}

export default function HowToFixPopper({ issue, anchorRect, onClose }: Props) {
  const ref = useAnchorDismiss(onClose);
  const catalog = getCatalogEntry(issue.id);
  if (!catalog || !anchorRect || typeof document === 'undefined') return null;

  const { help } = catalog;
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 620));

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label="How to fix"
      style={{
        position: 'fixed',
        top: anchorRect.bottom + 8,
        left,
        width: 600,
        maxWidth: 'calc(100vw - 16px)',
        zIndex: 200,
        display: 'flex',
        borderRadius: 8,
        border: '1px solid #DAD9DE',
        boxShadow: '0 4px 0 0 #E4E4E7, 0 12px 32px rgba(24, 26, 34, 0.12)',
        overflow: 'hidden',
        fontFamily: FONT,
        fontSize: 13,
        lineHeight: 1.55,
        color: '#18181B',
        animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ flex: 1, padding: '20px 24px', background: '#FFFFFF', minWidth: 0 }}>
        <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14 }}>About the issue</p>
        {help.about.map((para) => (
          <p key={para.slice(0, 40)} style={{ margin: '0 0 12px', color: '#18181B' }}>{para}</p>
        ))}
        {help.bullets && (
          <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
            {help.bullets.map((item) => (
              <li key={item} style={{ marginBottom: 4 }}>{item}</li>
            ))}
          </ul>
        )}
        {help.badge && (
          <span
            style={{
              display: 'inline-block',
              marginBottom: 8,
              padding: '2px 8px',
              borderRadius: 9999,
              background: '#F0F0F2',
              fontSize: 11,
              fontWeight: 600,
              color: '#52525C',
            }}
          >
            {help.badge}
          </span>
        )}
        {help.badgeExtra?.map((para) => (
          <p key={para.slice(0, 40)} style={{ margin: '0 0 12px', color: '#18181B' }}>{para}</p>
        ))}
        {help.articleLinks && help.articleLinks.length > 0 && (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#18181B' }}>
            For more information, please see these articles:{' '}
            {help.articleLinks.map((link, idx) => (
              <span key={link.href}>
                {idx > 0 && ' and '}
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2563EB', textDecoration: 'underline' }}
                >
                  {link.label}
                </a>
              </span>
            ))}
          </p>
        )}
        <p style={{ margin: '16px 0 0', fontSize: 12, color: '#52525C' }}>
          <strong style={{ color: '#18181B' }}>Category:</strong>
          {' '}
          {help.category}
        </p>
      </div>
      <div
        style={{
          width: 260,
          flexShrink: 0,
          padding: '20px 24px',
          background: help.showOptimizeAi ? '#F5F3FF' : '#F0F9F8',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14 }}>How to fix</p>
        {help.fixBullets ? (
          <ul style={{ margin: '0 0 16px', paddingLeft: 18, flex: 1 }}>
            {help.fix.map((item) => (
              <li key={item} style={{ marginBottom: 8 }}>{item}</li>
            ))}
          </ul>
        ) : (
          help.fix.map((para) => (
            <p key={para.slice(0, 40)} style={{ margin: '0 0 12px', flex: 1 }}>{para}</p>
          ))
        )}
        {help.showOptimizeAi && (
          <button
            type="button"
            disabled
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 16,
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#783AFB',
              color: '#FFFFFF',
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'not-allowed',
              opacity: 0.85,
            }}
          >
            <SparkleIcon />
            Optimize with AI
          </button>
        )}
        <p style={{ margin: 'auto 0 12px', fontSize: 12, color: '#52525C' }}>
          Work on the project with co-workers and keep everything organized
        </p>
        <button
          type="button"
          disabled
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #E4E4E7',
            background: '#FFFFFF',
            color: '#52525C',
            fontFamily: FONT,
            fontSize: 12,
            cursor: 'not-allowed',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 6a5 5 0 0 1 10 0H3Z" />
          </svg>
          Share
        </button>
      </div>
    </div>,
    document.body,
  );
}
