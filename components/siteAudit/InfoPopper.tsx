import React from 'react';
import { createPortal } from 'react-dom';
import { useAnchorDismiss } from './useAnchorDismiss';

const FONT = 'var(--font-family-primary)';

type Props = {
  anchorRect: DOMRect | null;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  align?: 'left' | 'right';
};

export default function InfoPopper({ anchorRect, onClose, children, width = 300, align = 'left' }: Props) {
  const ref = useAnchorDismiss(onClose);
  if (!anchorRect || typeof document === 'undefined') return null;

  const left = align === 'right' ? anchorRect.right - width : anchorRect.left;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      style={{
        position: 'fixed',
        top: anchorRect.bottom + 8,
        left: Math.max(8, left),
        width,
        maxWidth: 'calc(100vw - 16px)',
        zIndex: 150,
        background: '#FFFFFF',
        border: '1px solid #dbded4',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(24, 26, 34, 0.08)',
        padding: '16px 20px',
        fontFamily: FONT,
        fontSize: 13,
        lineHeight: 1.55,
        color: '#18181B',
        animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function PopperHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 13, color: '#18181B' }}>
      {children}
    </p>
  );
}

export function PopperList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: '#18181B' }}>
      {items.map((item) => (
        <li key={item} style={{ marginBottom: 4 }}>{item}</li>
      ))}
    </ul>
  );
}

export function PopperParagraph({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 12px', color: '#18181B' }}>{children}</p>;
}

export function PopperLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      style={{ color: '#783AFB', textDecoration: 'underline', textUnderlineOffset: 2 }}
    >
      {children}
    </a>
  );
}

export const dashedLinkStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  color: '#52525C',
  cursor: 'pointer',
  fontFamily: FONT,
  fontSize: 13,
  textDecoration: 'underline',
  textDecorationStyle: 'dashed',
  textUnderlineOffset: 3,
};
