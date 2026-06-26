import { parseWorkspaceId, workspaceHref } from '../../lib/activeWorkspace';

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
