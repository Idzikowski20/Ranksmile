import React, { useState, useRef, useEffect, useContext, createContext } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';

const TooltipPortalContext = createContext<{ container: HTMLElement | null }>({ container: null });
export const TooltipContextProvider = TooltipPortalContext.Provider;

interface TooltipProps {
  title: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  maxWidth?: number;
}

const TooltipContent = styled.div<{ position: { top: number; left: number }; maxWidth: number }>(({ position, maxWidth }) => ({
  position: 'fixed',
  zIndex: 10003,
  top: position.top,
  left: position.left,
  maxWidth,
  padding: '6px 10px',
  background: '#302E36',
  color: '#FFFFFF',
  fontSize: 11,
  fontFamily: "Rubik, 'Avenir Next', 'InterVariable', 'Inter', Arial, sans-serif",
  fontWeight: 400,
  borderRadius: 5,
  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  lineHeight: 1.4,
}));

export function Tooltip({ title, children, disabled, maxWidth = 225 }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const { container } = useContext(TooltipPortalContext);

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6 + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      });
    }
  }, [show]);

  if (disabled || !title) return <>{children}</>;

  return (
    <span
      ref={triggerRef}
      style={{ display: 'inline-flex', position: 'relative' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && createPortal(
        <TooltipContent position={pos} maxWidth={maxWidth} style={{ transform: 'translateX(-50%)' }}>
          {title}
        </TooltipContent>,
        container ?? document.body
      )}
    </span>
  );
}

/** Backward-compat alias for legacy `label` / `align` API. */
export function HoverTooltip({
  label,
  align: _align = 'left',
  children,
  maxWidth,
}: {
  label: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return <Tooltip title={label} maxWidth={maxWidth}>{children}</Tooltip>;
}

export default Tooltip;
