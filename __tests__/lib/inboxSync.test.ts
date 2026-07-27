/**
 * Stateful in-memory mock — sync revision / archive without live Postgres.
 */
jest.mock('../../lib/ensureNotificationTables', () => ({
  ensureNotificationTables: jest.fn().mockResolvedValue(undefined),
}));

type EventRow = {
  event_id: string;
  org_id: number;
  workspace_id: number;
  domain_id: number;
  type: string;
  title: string;
  body: string;
  href: string;
  current_count: number;
  revision: number;
  payload_json: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

const store: {
  events: Map<string, EventRow>;
  snapshot: Array<{
    domain_id: number;
    workspace_id: number;
    domain: string;
    slug: string;
    org_id: number;
    current_count: number;
  }>;
  lockCalls: number;
} = {
  events: new Map(),
  snapshot: [],
  lockCalls: 0,
};

function resetStore(): void {
  store.events.clear();
  store.snapshot = [];
  store.lockCalls = 0;
}

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (cb: (tx: unknown) => Promise<void>) => cb('TX')),
    query: jest.fn(async (sql: string, opts?: { replacements?: unknown[]; transaction?: unknown }) => {
      const s = String(sql);
      const r = opts?.replacements ?? [];

      if (s.includes('pg_advisory_xact_lock')) {
        store.lockCalls += 1;
        return [[], {}];
      }

      if (s.includes('FROM domain d') && s.includes('GROUP BY')) {
        return [store.snapshot.map((row) => ({ ...row })), {}];
      }

      if (s.includes('INSERT INTO notification_events') && s.includes('ON CONFLICT')) {
        const [
          eventId, orgId, workspaceId, domainId, type,
          title, body, href, currentCount, payloadJson, updatedAt,
        ] = r as [string, number, number, number, string, string, string, string, number, string, string];
        const existing = store.events.get(eventId);
        if (!existing) {
          store.events.set(eventId, {
            event_id: eventId,
            org_id: orgId,
            workspace_id: workspaceId,
            domain_id: domainId,
            type,
            title,
            body,
            href,
            current_count: currentCount,
            revision: 1,
            payload_json: payloadJson,
            created_at: updatedAt,
            updated_at: updatedAt,
            archived_at: null,
          });
          return [[], {}];
        }
        const countChanged = existing.current_count !== currentCount;
        const wasArchived = existing.archived_at != null;
        const wsChanged = existing.workspace_id !== workspaceId;
        const timeChanged = existing.updated_at !== updatedAt;
        if (countChanged || wasArchived || wsChanged || timeChanged) {
          existing.body = body;
          existing.title = title;
          existing.href = href;
          existing.current_count = currentCount;
          existing.workspace_id = workspaceId;
          existing.org_id = orgId;
          existing.payload_json = payloadJson;
          existing.archived_at = null;
          if (countChanged || wasArchived || wsChanged) existing.revision += 1;
          existing.updated_at = updatedAt;
        }
        return [[], {}];
      }

      if (s.includes('UPDATE notification_events') && s.includes('archived_at = CURRENT_TIMESTAMP')) {
        const orgId = Number(r[0]);
        const rest = r.slice(1);
        if (s.includes('NOT IN')) {
          const wsCount = (s.match(/\?/g) ?? []).length - rest.length;
          const wsIds = rest.slice(0, Math.max(0, rest.length - (rest.length > 1 ? rest.length - 1 : 0)));
          // orgId + ws placeholders + domain placeholders
          const domainIds = new Set(rest.slice(wsIds.length).map(Number));
          const workspaceIds = new Set(rest.slice(0, -domainIds.size).map(Number));
          for (const ev of store.events.values()) {
            if (ev.org_id !== orgId || ev.archived_at != null) continue;
            if (workspaceIds.size && !workspaceIds.has(ev.workspace_id)) continue;
            if (!domainIds.has(ev.domain_id)) ev.archived_at = nowIso();
          }
        } else if (s.includes('workspace_id IN')) {
          const wsIds = new Set(rest.map(Number));
          for (const ev of store.events.values()) {
            if (ev.org_id === orgId && wsIds.has(ev.workspace_id) && ev.archived_at == null) {
              ev.archived_at = nowIso();
            }
          }
        } else {
          for (const ev of store.events.values()) {
            if (ev.org_id === orgId && ev.archived_at == null) ev.archived_at = nowIso();
          }
        }
        return [[], {}];
      }

      return [[], {}];
    }),
  },
}));

function nowIso(): string {
  return new Date().toISOString();
}

import { optimizationEventId } from '../../lib/notifications/copy';
import { syncOptimizationInbox } from '../../lib/notifications/syncOptimizationInbox';

const ORG = 1;
const WS = 9;

describe('syncOptimizationInbox', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  it('creates projection revision=1 when count > 0', async () => {
    store.snapshot = [{
      domain_id: 42, workspace_id: WS, domain: 'a.com', slug: 'a-com', org_id: ORG,
      current_count: 3, latest_at: '2026-01-15T12:00:00.000Z',
    }];
    await syncOptimizationInbox(ORG, [WS]);
    const ev = store.events.get(optimizationEventId(42));
    expect(ev?.revision).toBe(1);
    expect(ev?.current_count).toBe(3);
    expect(ev?.updated_at).toBe('2026-01-15T12:00:00.000Z');
    expect(ev?.archived_at).toBeNull();
  });

  it('does not bump revision when count unchanged', async () => {
    store.snapshot = [{
      domain_id: 42, workspace_id: WS, domain: 'a.com', slug: 'a-com', org_id: ORG,
      current_count: 3, latest_at: '2026-01-15T12:00:00.000Z',
    }];
    await syncOptimizationInbox(ORG, [WS]);
    const ev1 = store.events.get(optimizationEventId(42))!;
    const rev = ev1.revision;
    await syncOptimizationInbox(ORG, [WS]);
    const ev2 = store.events.get(optimizationEventId(42))!;
    expect(ev2.revision).toBe(rev);
    expect(ev2.updated_at).toBe('2026-01-15T12:00:00.000Z');
  });

  it('bumps revision when count changes', async () => {
    store.snapshot = [{
      domain_id: 42, workspace_id: WS, domain: 'a.com', slug: 'a-com', org_id: ORG,
      current_count: 2, latest_at: '2026-01-15T12:00:00.000Z',
    }];
    await syncOptimizationInbox(ORG, [WS]);
    store.snapshot[0].current_count = 5;
    store.snapshot[0].latest_at = '2026-01-16T12:00:00.000Z';
    await syncOptimizationInbox(ORG, [WS]);
    expect(store.events.get(optimizationEventId(42))?.revision).toBe(2);
    store.snapshot[0].current_count = 1;
    await syncOptimizationInbox(ORG, [WS]);
    expect(store.events.get(optimizationEventId(42))?.revision).toBe(3);
  });

  it('archives when domain drops out of positive snapshot (count 0)', async () => {
    store.snapshot = [{
      domain_id: 42, workspace_id: WS, domain: 'a.com', slug: 'a-com', org_id: ORG,
      current_count: 2, latest_at: '2026-01-15T12:00:00.000Z',
    }];
    await syncOptimizationInbox(ORG, [WS]);
    store.snapshot = [{
      domain_id: 42, workspace_id: WS, domain: 'a.com', slug: 'a-com', org_id: ORG,
      current_count: 0, latest_at: null,
    }];
    await syncOptimizationInbox(ORG, [WS]);
    expect(store.events.get(optimizationEventId(42))?.archived_at).not.toBeNull();
  });

  it('unarchives with revision bump when count returns positive', async () => {
    store.snapshot = [{
      domain_id: 42, workspace_id: WS, domain: 'a.com', slug: 'a-com', org_id: ORG,
      current_count: 2, latest_at: '2026-01-15T12:00:00.000Z',
    }];
    await syncOptimizationInbox(ORG, [WS]);
    store.snapshot[0].current_count = 0;
    await syncOptimizationInbox(ORG, [WS]);
    const revAfterArchive = store.events.get(optimizationEventId(42))!.revision;
    store.snapshot[0].current_count = 4;
    store.snapshot[0].latest_at = '2026-01-20T12:00:00.000Z';
    await syncOptimizationInbox(ORG, [WS]);
    const ev = store.events.get(optimizationEventId(42))!;
    expect(ev.archived_at).toBeNull();
    expect(ev.revision).toBe(revAfterArchive + 1);
  });

  it('acquires org advisory lock during sync', async () => {
    store.snapshot = [{
      domain_id: 42, workspace_id: WS, domain: 'a.com', slug: 'a-com', org_id: ORG,
      current_count: 1, latest_at: '2026-01-15T12:00:00.000Z',
    }];
    await syncOptimizationInbox(ORG, [WS]);
    expect(store.lockCalls).toBeGreaterThan(0);
  });
});
