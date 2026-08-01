import React from 'react';
import { SlideOverPanel } from '../koala/core';
import useOnKey from '../../hooks/useOnKey';

const WIDTH_MAP = {
  small: '28rem',
  medium: '50vw',
  large: '70vw',
} as const;

type SidePanelProps = {
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: keyof typeof WIDTH_MAP | string | number;
  position?: 'left' | 'right';
};

const resolveWidth = (width?: SidePanelProps['width']) => {
  if (width == null) return WIDTH_MAP.medium;
  if (typeof width === 'string' && width in WIDTH_MAP) {
    return WIDTH_MAP[width as keyof typeof WIDTH_MAP];
  }
  return width;
};

const SidePanel = ({
  children,
  open,
  onClose,
  width,
  position = 'right',
  title = '',
}: SidePanelProps) => {
  useOnKey('Escape', onClose);

  if (!open) return null;

  return (
    <SlideOverPanel
      title={title}
      onClose={onClose}
      position={position}
      width={resolveWidth(width)}
    >
      {children}
    </SlideOverPanel>
  );
};

export default SidePanel;
