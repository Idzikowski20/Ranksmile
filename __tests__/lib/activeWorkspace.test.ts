import {
  parseWorkspaceId, workspaceHref, deriveActiveId, foreignWorkspaceFallback,
} from '@/src/core/domain/navigation/activeWorkspace';

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

describe('foreignWorkspaceFallback', () => {
  const ws = { workspaceIds: [2, 3], setupWorkspaceId: null, activeId: 2 };

  it('leaves an accessible workspace URL alone', () => {
    expect(foreignWorkspaceFallback('/workspace/3/articles', ws)).toBeNull();
    expect(foreignWorkspaceFallback('/workspace/3-idztech/articles?x=1', ws)).toBeNull();
  });

  it('leaves URLs without a workspace alone', () => {
    expect(foreignWorkspaceFallback('/plans', ws)).toBeNull();
    expect(foreignWorkspaceFallback('/', ws)).toBeNull();
  });

  it('allows the in-progress setup workspace, which is not in the ready list', () => {
    expect(foreignWorkspaceFallback('/workspace/9/setup', { ...ws, setupWorkspaceId: 9 })).toBeNull();
  });

  it('moves an inaccessible workspace URL to the same page of the active workspace', () => {
    expect(foreignWorkspaceFallback('/workspace/7/articles', ws)).toBe('/workspace/2/articles');
    expect(foreignWorkspaceFallback('/workspace/7-old/automations?view=week', ws)).toBe('/workspace/2/automations?view=week');
    expect(foreignWorkspaceFallback('/workspace/7', ws)).toBe('/workspace/2/dashboard');
  });

  it('sends the user home when no workspace is accessible', () => {
    expect(foreignWorkspaceFallback('/workspace/7/articles', { workspaceIds: [], setupWorkspaceId: null, activeId: null })).toBe('/');
  });
});
