import { useMutation, useQuery, useQueryClient } from 'react-query';
import type { InboxListResponse } from '../lib/notifications/types';

const KEY = 'inbox';

export function useInbox(opts: { enabled?: boolean; unreadOnly?: boolean } = {}) {
  const { enabled = true, unreadOnly = false } = opts;
  return useQuery<InboxListResponse>(
    [KEY, unreadOnly ? 'unread' : 'all'],
    async () => {
      const qs = unreadOnly ? '?unreadOnly=1' : '';
      const res = await fetch(`/api/inbox${qs}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as { error?: string }).error || 'Failed to load inbox');
      return d as InboxListResponse;
    },
    { enabled, staleTime: 30_000, refetchOnWindowFocus: false },
  );
}

export function useMarkInboxRead() {
  const qc = useQueryClient();
  return useMutation(
    async (input: { eventIds?: string[]; all?: boolean }) => {
      const res = await fetch('/api/inbox/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as { error?: string }).error || 'Failed to mark read');
      return d;
    },
    { onSuccess: () => qc.invalidateQueries(KEY) },
  );
}
