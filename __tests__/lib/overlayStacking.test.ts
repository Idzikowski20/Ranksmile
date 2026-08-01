import { zIndex } from '../../components/koala/tokens/zIndex';
import { overlayZ } from '../../components/koala/overlay/ShellPortal';

/** Chrome layers that must sit under global drawer/modal overlays. */
const SHELL_TOPBAR_Z = 180;
const SHELL_SIDEBAR_Z = 40;
/** `.app-shell-body` traps in-tree fixed overlays — portals must use overlayZ. */
const SHELL_BODY_Z = 1;

describe('overlay stacking (Koala)', () => {
  it('drawer and modal paint above sidebar and topbar', () => {
    expect(zIndex.drawer).toBeGreaterThan(SHELL_TOPBAR_Z);
    expect(zIndex.drawer).toBeGreaterThan(SHELL_SIDEBAR_Z);
    expect(zIndex.modal).toBeGreaterThan(zIndex.drawer);
    expect(zIndex.toast).toBeGreaterThan(zIndex.modal);
  });

  it('ShellPortal tokens clear shell chrome (portal required — in-tree fixed cannot escape body)', () => {
    expect(SHELL_BODY_Z).toBeLessThan(SHELL_TOPBAR_Z);
    expect(overlayZ.drawer).toBe(zIndex.drawer);
    expect(overlayZ.drawerPanel).toBeGreaterThan(overlayZ.drawer);
    expect(overlayZ.modal).toBe(zIndex.modal);
    expect(overlayZ.modal).toBeGreaterThan(SHELL_TOPBAR_Z);
  });
});
