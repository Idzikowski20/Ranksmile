/**
 * mark-read / unreadCount / no-downgrade — stateful in-memory mock.
 */
jest.mock('../../lib/ensureNotificationTables', () => ({
  ensureNotificationTables: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/tenancy', () => ({
  ensureUserTenancy: jest.fn().mockResolvedValue({ orgId: 1 }),
  getAccessibleWorkspaceIds: jest.fn().mockResolvedValue([9]),
}));

type EventRow = {
  event_id: string;
  workspace_id: number;
  revision: number;
  archived_at: string | null;
  updated_at: string;
};

type ReadRow = {
  user_id: string;
  event_id: string;
  read_revision: number;
  read_at: string;
};

const store: { events: Map<string, EventRow>; reads: Map<string, ReadRow> } = {
  events: new Map(),
  reads: new Map(),
};

function readKey(userId: string, eventId: string): string {
  return `${userId}|${eventId}`;
}

function seedEvent(eventId: string, revision: number, archived = false): void {
  store.events.set(eventId, {
    event_id: eventId,
    workspace_id: 9,
    revision,
    archived_at: archived ? '2026-01-01' : null,
    updated_at: '2026-01-02T00:00:00.000Z',
  });
}

jest.mock('../../database/database', () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (cb: (tx: unknown) => Promise<void>) => cb('TX')),
    query: jest.fn(async (sql: string, opts?: { replacements?: unknown[]; type?: string }) => {
      const s = String(sql);
      const r = opts?.replacements ?? [];
      const asSelect = opts?.type != null;
      const wrap = (rows: unknown[]) => (asSelect ? rows : [rows, {}]);

      if (s.includes('SELECT COUNT(*) AS n')) {
        const [userId] = r as [string];
        let n = 0;
        for (const ev of store.events.values()) {
          if (ev.archived_at != null || ev.workspace_id !== 9) continue;
          const read = store.reads.get(readKey(userId, ev.event_id));
          if (!read || read.read_revision < ev.revision) n += 1;
        }
        return wrap([{ n }]);
      }

      if (s.includes('FROM notification_events e') && s.includes('ORDER BY')) {
        const [userId] = r as [string];
        const limit = Number(r[r.length - 1]);
        const unreadOnly = s.includes('r.read_revision < e.revision');
        const mapped = [...store.events.values()]
          .filter((ev) => ev.archived_at == null && ev.workspace_id === 9)
          .filter((ev) => {
            if (!unreadOnly) return true;
            const read = store.reads.get(readKey(userId, ev.event_id));
            return !read || read.read_revision < ev.revision;
          })
          .map((ev) => {
            const read = store.reads.get(readKey(userId, ev.event_id));
            return {
              event_id: ev.event_id,
              type: 'optimization_recommendation',
              title: 'New optimization recommendation',
              body: 'body',
              href: '/sites/a/recommendations',
              current_count: 2,
              revision: ev.revision,
              updated_at: ev.updated_at,
              payload_json: '{"domain":"a.com","slug":"a"}',
              read_revision: read?.read_revision ?? null,
            };
          });
        const rows = Number.isFinite(limit) ? mapped.slice(0, limit) : mapped;
        return [rows, {}];
      }

      if (s.includes('INSERT INTO notification_reads') && s.includes('ON CONFLICT')) {
        const userId = String(r[0]);
        const eventFilter = s.includes('e.event_id IN');
        const all = !eventFilter;
        const eventIds = eventFilter
          ? (r.slice(1, r.length - 1) as string[])
          : [];
        for (const ev of store.events.values()) {
          if (ev.archived_at != null || ev.workspace_id !== 9) continue;
          if (!all && !eventIds.includes(ev.event_id)) continue;
          const key = readKey(userId, ev.event_id);
          const existing = store.reads.get(key);
          const nextRev = ev.revision;
          if (!existing) {
            store.reads.set(key, {
              user_id: userId,
              event_id: ev.event_id,
              read_revision: nextRev,
              read_at: new Date().toISOString(),
            });
          } else if (existing.read_revision < nextRev) {
            existing.read_revision = nextRev;
            existing.read_at = new Date().toISOString();
          }
        }
        return [[], {}];
      }

      if (s.includes('pg_advisory_xact_lock')) return [[], {}];
      return wrap([]);
    }),
  },
}));

import { listInboxForUser, markInboxRead } from '../../lib/notifications/inboxService';

const E1 = 'optimization_recommendation:domain:1';

describe('inboxService mark-read', () => {
  beforeEach(() => {
    store.events.clear();
    store.reads.clear();
    seedEvent(E1, 5);
  });

  it('marks read at current revision', async () => {
    await markInboxRead('u1', { eventIds: [E1] });
    const list = await listInboxForUser('u1');
    expect(list.items[0]?.isRead).toBe(true);
    expect(list.unreadCount).toBe(0);
  });

  it('becomes unread after revision bump without deleting reads', async () => {
    await markInboxRead('u1', { eventIds: [E1] });
    store.events.get(E1)!.revision = 6;
    const list = await listInboxForUser('u1');
    expect(list.items[0]?.isRead).toBe(false);
    expect(list.unreadCount).toBe(1);
    expect(store.reads.has(readKey('u1', E1))).toBe(true);
  });

  it('does not downgrade read_revision', async () => {
    store.reads.set(readKey('u1', E1), {
      user_id: 'u1', event_id: E1, read_revision: 7, read_at: '2026-01-01',
    });
    store.events.get(E1)!.revision = 6;
    await markInboxRead('u1', { eventIds: [E1] });
    expect(store.reads.get(readKey('u1', E1))?.read_revision).toBe(7);
  });

  it('mark-all is snapshot-safe — later revision stays unread', async () => {
    await markInboxRead('u1', { all: true });
    expect(store.reads.get(readKey('u1', E1))?.read_revision).toBe(5);
    store.events.get(E1)!.revision = 6;
    const list = await listInboxForUser('u1');
    expect(list.unreadCount).toBe(1);
  });

  it('unreadCount independent of unreadOnly filter', async () => {
    seedEvent('optimization_recommendation:domain:2', 1);
    const all = await listInboxForUser('u1', { unreadOnly: false, limit: 1 });
    const unread = await listInboxForUser('u1', { unreadOnly: true, limit: 1 });
    expect(all.items.length).toBe(1);
    expect(unread.items.length).toBeLessThanOrEqual(1);
    expect(all.unreadCount).toBe(unread.unreadCount);
    expect(all.unreadCount).toBe(2);
  });
});
