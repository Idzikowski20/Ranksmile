import { useMutation, useQuery, useQueryClient } from 'react-query';

export type StageState = 'pending' | 'running' | 'done';
export type SetupStatus = {
   // 'finalizing' is what job-progress sets while it materializes the result — the row
   // is not done yet, and typing it away made the client treat it as an unknown state.
   status: 'none' | 'queued' | 'running' | 'finalizing' | 'done' | 'failed';
   currentStage: string | null;
   stagePercent: number;
   stages: Record<'gsc' | 'keywords' | 'topics' | 'competitors' | 'recommendations', StageState>;
   error: string | null;
   auditCounts: { audited: number; skipped: number; total: number } | null;
   /** Site Speed Score (PageSpeed Insights) runs as part of the campaign. 'off' when the
    *  API key is not configured, so the step is hidden. Optional for older payloads. */
   siteSpeed?: 'off' | 'running' | 'done';
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
         refetchInterval: (data) => {
            if (data?.status === 'running' || data?.status === 'finalizing') return 2000;
            // Site Speed runs alongside the crawl and can land after the job is done; keep
            // polling so the audit page learns when its score is ready.
            if (data?.siteSpeed === 'running') return 2000;
            return data?.status === 'queued' ? 5000 : false;
         },
      },
   );
}

/** The setup pipeline holds the domain: queued, running, or materialising its result. */
export function isSetupBusy(setup?: SetupStatus): boolean {
   return !!setup && ['queued', 'running', 'finalizing'].includes(setup.status);
}

/**
 * Whether content creation and AI Visibility are paused for this domain. Same poll as
 * the progress pill, so the moment the pill goes the pages unlock. Undefined slug or a
 * status not yet loaded reads as free — the server answers 409 either way.
 */
export function useDomainBusy(slug: string | null | undefined): boolean {
   const { data } = useSetupStatus(slug);
   return isSetupBusy(data);
}

export function useRunSetup() {
   const qc = useQueryClient();
   return useMutation(
      async (slug: string) => {
         const r = await fetch(`/api/domains/${slug}/run-setup`, { method: 'POST' });
         const body = await r.json().catch(() => ({})) as { error?: string; jobId?: string; alreadyRunning?: boolean };
         if (!r.ok) throw new Error(body.error ?? `Run setup failed (${r.status})`);
         return body;
      },
      // Refetch setup-status right after kicking so the fallback effect sees 'queued'
      // (not stale 'none') and stops firing — prevents a run-setup retry storm.
      { onSuccess: (_d, slug) => qc.invalidateQueries(['setup-status', slug]) },
   );
}
