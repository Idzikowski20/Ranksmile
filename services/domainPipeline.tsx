import { useMutation, useQuery } from 'react-query';

export type StageState = 'pending' | 'running' | 'done';
export type SetupStatus = {
   status: 'none' | 'queued' | 'running' | 'done' | 'failed';
   currentStage: string | null;
   stagePercent: number;
   stages: Record<'gsc' | 'keywords' | 'topics' | 'competitors' | 'recommendations', StageState>;
   error: string | null;
};

export function useSetupStatus(domainId: number | null | undefined) {
   return useQuery<SetupStatus>(
      ['setup-status', domainId],
      async () => {
         const r = await fetch(`/api/domains/${domainId}/setup-status`);
         return r.json();
      },
      {
         enabled: !!domainId,
         refetchInterval: (data) => (
            data?.status === 'running' ? 2000
            : data?.status === 'queued' ? 5000
            : false
         ),
      },
   );
}

export function useRunSetup() {
   return useMutation((domainId: number) =>
      fetch(`/api/domains/${domainId}/run-setup`, { method: 'POST' }).then((r) => r.json()),
   );
}
