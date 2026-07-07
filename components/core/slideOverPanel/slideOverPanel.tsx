import React from 'react';
import styled from '@emotion/styled';

const OVERLAY_Z = 9998;
const PANEL_Z = 9999;

const Backdrop = styled.div`
  position: fixed; inset: 0; z-index: ${OVERLAY_Z};
  background: rgba(0,0,0,0.12);
`;

const Panel = styled.aside<{ $position: 'right' | 'left'; $width: string }>(({ $position, $width }) => ({
  position: 'fixed',
  top: 0, bottom: 0,
  [$position]: 0,
  zIndex: PANEL_Z,
  width: $width,
  maxWidth: '100vw',
  background: '#FFFFFF',
  boxShadow: $position === 'right'
    ? '-8px 0 32px rgba(0,0,0,0.08)'
    : '8px 0 32px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: "Rubik, 'Avenir Next', 'InterVariable', 'Inter', Arial, sans-serif",
}));

const Header = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 24px; border-bottom: 1px solid #E6E6E9;
`;

const Title = styled.h2`
  margin: 0; font-size: 18px; font-weight: 500; color: #181225;
`;

const CloseBtn = styled.button`
  display: inline-flex; align-items: center; justify-content: center;
  padding: 6px; border-radius: 5px; border: 1px solid #DAD9DE;
  background: #FFFFFF; color: #6A6772; cursor: pointer;
`;

const Body = styled.div`
  flex: 1; overflow: auto; padding: 24px;
`;

const CloseX = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
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

export function SlideOverPanel({ children, title, onClose, position = 'right', width = '50vw' }: SlideOverPanelProps) {
  return (
    <>
      <Backdrop onClick={onClose} />
      <Panel $position={position} $width={typeof width === 'number' ? `${width}px` : width}>
        {title && (
          <Header>
            <Title>{title}</Title>
            <CloseBtn onClick={onClose} aria-label="Close panel"><CloseX /></CloseBtn>
          </Header>
        )}
        <Body>{children}</Body>
      </Panel>
    </>
  );
}

export default SlideOverPanel;
