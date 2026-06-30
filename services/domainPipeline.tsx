import { useMutation, useQuery, useQueryClient } from 'react-query';

export type StageState = 'pending' | 'running' | 'done';
export type SetupStatus = {
   status: 'none' | 'queued' | 'running' | 'done' | 'failed';
   currentStage: string | null;
   stagePercent: number;
   stages: Record<'gsc' | 'keywords' | 'topics' | 'competitors' | 'recommendations', StageState>;
   error: string | null;
   auditCounts: { audited: number; skipped: number; total: number } | null;
};

// Domains are addressed by slug across the app (the `pages/api/domains/[slug]` +
// `sites/[domain]` convention); the endpoints resolve slug → domain id internally.
export function useSetupStatus(slug: string | null | undefined) {
   return useQuery<SetupStatus>(
      ['setup-status', slug],
      async () => {
         const r = await fetch(`/api/domains/${slug}/setup-status`);
         return r.json();
      },
      {
         enabled: !!slug,
         refetchInterval: (data) => (
            data?.status === 'running' ? 2000
            : data?.status === 'queued' ? 5000
            : false
         ),
      },
   );
}

export function useRunSetup() {
   const qc = useQueryClient();
   return useMutation(
      (slug: string) => fetch(`/api/domains/${slug}/run-setup`, { method: 'POST' }).then((r) => r.json()),
      // Refetch setup-status right after kicking so the fallback effect sees 'queued'
      // (not stale 'none') and stops firing — prevents a run-setup retry storm.
      { onSuccess: (_d, slug) => qc.invalidateQueries(['setup-status', slug]) },
   );
}
