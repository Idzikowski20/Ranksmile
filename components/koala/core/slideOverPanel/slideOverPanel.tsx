import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { zIndex } from '../../tokens/zIndex';
import { semantic } from '../../tokens/semantic';
import { typeface } from '../../tokens/typography';

/**
 * Root cause of shell-not-dimmed overlays: panels rendered inside page tree
 * (or with z-index below `.global-topbar` 180) only cover the content stack.
 * Portal + drawer z-index paints above sidebar/topbar globally.
 */
const Root = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndex.drawer};
`;

const Backdrop = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(26, 26, 26, 0.45);
`;

const Panel = styled.aside<{ $position: 'right' | 'left'; $width: string }>(({ $position, $width }) => ({
  position: 'absolute',
  top: 8,
  bottom: 8,
  [$position]: 8,
  zIndex: 1,
  width: $width,
  maxWidth: 'calc(100vw - 16px)',
  background: semantic.card.bg,
  borderRadius: 12,
  boxShadow: $position === 'right'
    ? '-8px 0 32px rgba(0,0,0,0.12)'
    : '8px 0 32px rgba(0,0,0,0.12)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: typeface.body,
}));

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid ${semantic.border.primary};
`;

const Title = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${semantic.text.primary};
  letter-spacing: -0.4px;
`;

const CloseBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 8px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.primary};
  color: ${semantic.text.secondary};
  cursor: var(--koala-cursor-pointing, pointer);
`;

const Body = styled.div`
  flex: 1;
  overflow: auto;
  padding: 24px;
`;

const CloseX = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

interface SlideOverPanelProps {
  children: React.ReactNode;
  title?: string;
  onClose: () => void;
  position?: 'right' | 'left';
  width?: string | number;
}

export function SlideOverPanel({
  children,
  title,
  onClose,
  position = 'right',
  width = '50vw',
}: SlideOverPanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const widthCss = typeof width === 'number' ? `${width}px` : width;

  return createPortal(
    <Root role="presentation">
      <Backdrop onClick={onClose} aria-hidden />
      <Panel
        $position={position}
        $width={widthCss}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Panel'}
      >
        {title ? (
          <Header>
            <Title>{title}</Title>
            <CloseBtn type="button" onClick={onClose} aria-label="Close panel">
              <CloseX />
            </CloseBtn>
          </Header>
        ) : null}
        <Body className="styled-scrollbar">{children}</Body>
      </Panel>
    </Root>,
    document.body,
  );
}

export default SlideOverPanel;
