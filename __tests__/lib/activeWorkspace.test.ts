import { parseWorkspaceId, workspaceHref, deriveActiveId } from '../../lib/activeWorkspace';

describe('deriveActiveId (SSR-safe)', () => {
  it('ignores the URL until mounted, so server + first client render match', () => {
    // SSR/first-client render: even though the client URL carries /workspace/2, !mounted → null
    expect(deriveActiveId(false, '/workspace/2/dashboard', null)).toBeNull();
    expect(deriveActiveId(false, '/workspace/2/dashboard', undefined)).toBeNull();
    // falls back to the server-reported activeId when present
    expect(deriveActiveId(false, '/workspace/2/dashboard', 5)).toBe(5);
  });
  it('reads the workspace id from the URL once mounted', () => {
    expect(deriveActiveId(true, '/workspace/2/dashboard', null)).toBe(2);
    expect(deriveActiveId(true, '/dashboard', 5)).toBe(5); // no URL id → server activeId
    expect(deriveActiveId(true, '/dashboard', null)).toBeNull();
  });
});

describe('parseWorkspaceId', () => {
  it('extracts the numeric id from a /workspace/<id>-<slug>/... path', () => {
    expect(parseWorkspaceId('/workspace/1361078-vegra/dashboard')).toBe(1361078);
    expect(parseWorkspaceId('/workspace/42/sites/x.pl/performance')).toBe(42);
  });
  it('returns null when the path is not workspace-scoped', () => {
    expect(parseWorkspaceId('/dashboard')).toBeNull();
    expect(parseWorkspaceId('/workspace/abc/x')).toBeNull();
    expect(parseWorkspaceId('')).toBeNull();
  });
});

describe('workspaceHref', () => {
  it('builds a workspace-scoped path', () => {
    expect(workspaceHref(7, '/dashboard')).toBe('/workspace/7/dashboard');
    expect(workspaceHref(7, 'sites/x.pl')).toBe('/workspace/7/sites/x.pl');
  });
  it('returns the bare path when wsId is falsy', () => {
    expect(workspaceHref(0, '/dashboard')).toBe('/dashboard');
    expect(workspaceHref(null as any, '/dashboard')).toBe('/dashboard');
  });
});
