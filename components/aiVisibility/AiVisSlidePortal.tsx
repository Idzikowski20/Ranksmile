import { overlayZ, ShellPortal } from '../koala/overlay/ShellPortal';

/**
 * AI Visibility slide-overs must leave `.app-content` (z-index: 2).
 * Inside that stacking context, even `position:fixed; z-index:300` paints
 * under `.koala-sidebar` (40) and `.global-topbar` (180).
 * Portal + drawer token matches `SlideOverPanel`.
 */
export const aiVisOverlayZ = {
  backdrop: overlayZ.drawer,
  panel: overlayZ.drawerPanel,
} as const;

export const AiVisSlidePortal = ShellPortal;
