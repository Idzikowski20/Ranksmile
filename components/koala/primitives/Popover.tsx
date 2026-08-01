import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { shadow, radius } from '../tokens/effects';
import { zIndex } from '../tokens/zIndex';
import { typeface } from '../tokens/typography';
import { popoverMotion } from '../motion';

const Panel = styled.div`
  position: fixed;
  z-index: ${zIndex.popover};
  min-width: 180px;
  max-width: min(460px, calc(100vw - 24px));
  background: ${semantic.card.bg};
  border: 1px solid ${semantic.card.border};
  border-radius: ${radius.card.default};
  box-shadow: ${shadow.md};
  padding: 6px;
  font-family: ${typeface.body};
  ${popoverMotion};
`;

export type PopoverPlacement = 'bottom' | 'top' | 'right';

/**
 * Popover — lightweight overlay. Modal stack: prefer Popover over nested Dialog
 * for Share / Feedback / menus.
 */
export type PopoverProps = {
  open: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  children: React.ReactNode;
  className?: string;
  /** Default `bottom`. Sidebar footers usually want `right` or `top`. */
  placement?: PopoverPlacement;
};

function panelStyle(anchor: DOMRect, placement: PopoverPlacement): React.CSSProperties {
  if (placement === 'right') {
    const left = Math.max(8, Math.min(anchor.right + 8, window.innerWidth - 24));
    // Sidebar footer sits near the bottom — pin to bottom so the panel grows upward.
    const spaceBelow = window.innerHeight - anchor.top;
    if (spaceBelow < 360) {
      return {
        top: 'auto',
        bottom: Math.max(8, window.innerHeight - anchor.bottom),
        left,
        maxHeight: Math.max(160, window.innerHeight - 16),
        overflowY: 'auto',
      };
    }
    return {
      top: Math.max(8, anchor.top),
      left,
      bottom: 'auto',
      maxHeight: Math.max(160, window.innerHeight - Math.max(8, anchor.top) - 8),
      overflowY: 'auto',
    };
  }
  if (placement === 'top') {
    return {
      top: 'auto',
      bottom: Math.max(8, window.innerHeight - anchor.top + 8),
      left: Math.min(Math.max(8, anchor.left), window.innerWidth - 200),
      maxHeight: Math.max(160, anchor.top - 16),
      overflowY: 'auto',
    };
  }
  return {
    top: Math.min(anchor.bottom + 8, window.innerHeight - 16),
    left: Math.min(Math.max(8, anchor.left), window.innerWidth - 200),
    bottom: 'auto',
    maxHeight: Math.max(160, window.innerHeight - Math.min(anchor.bottom + 8, window.innerHeight - 16) - 8),
    overflowY: 'auto',
  };
}

/** Keep the panel inside the viewport after it mounts / content settles. */
function clampToViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  let top = rect.top;
  let left = rect.left;

  if (rect.bottom > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - 8 - rect.height);
  }
  if (top < 8) top = 8;
  if (rect.right > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - 8 - rect.width);
  }
  if (left < 8) left = 8;

  el.style.top = `${Math.round(top)}px`;
  el.style.bottom = 'auto';
  el.style.left = `${Math.round(left)}px`;
}

/** Koala Popover — Figma `9421:366505`. Positioned from anchor rect. */
export function Popover({
  open,
  onClose,
  anchorRect,
  children,
  className,
  placement = 'bottom',
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    clampToViewport(ref.current);
  }, [open, children, anchorRect, placement]);

  if (!open || !anchorRect || typeof document === 'undefined') return null;

  return createPortal(
    <Panel
      ref={ref}
      className={className}
      role="dialog"
      style={panelStyle(anchorRect, placement)}
    >
      {children}
    </Panel>,
    document.body,
  );
}

export default Popover;
