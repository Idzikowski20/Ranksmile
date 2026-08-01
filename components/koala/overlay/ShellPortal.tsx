import React from 'react';
import { createPortal } from 'react-dom';
import { zIndex } from '../tokens/zIndex';

/**
 * Escape `.app-shell-body` (z-index: 1). In-tree `position:fixed` cannot paint
 * above `.koala-sidebar` (40) or `.global-topbar` (180) without a body portal.
 */
export const overlayZ = {
  drawer: zIndex.drawer,
  drawerPanel: zIndex.drawer + 1,
  modal: zIndex.modal,
} as const;

export function ShellPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
