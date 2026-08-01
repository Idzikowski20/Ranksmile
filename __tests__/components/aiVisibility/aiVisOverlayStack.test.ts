import { aiVisOverlayZ } from '../../../components/aiVisibility/AiVisSlidePortal';
import { zIndex } from '../../../components/koala/tokens/zIndex';

/** Shell chrome that must stay under AI Visibility slide-overs. */
const SHELL_TOPBAR_Z = 180;
const SHELL_SIDEBAR_Z = 40;

describe('aiVisOverlayZ', () => {
  it('uses drawer stack so overlays beat sidebar + topbar stacking contexts', () => {
    expect(aiVisOverlayZ.backdrop).toBe(zIndex.drawer);
    expect(aiVisOverlayZ.panel).toBeGreaterThan(aiVisOverlayZ.backdrop);
    expect(aiVisOverlayZ.backdrop).toBeGreaterThan(SHELL_TOPBAR_Z);
    expect(aiVisOverlayZ.backdrop).toBeGreaterThan(SHELL_SIDEBAR_Z);
  });
});
