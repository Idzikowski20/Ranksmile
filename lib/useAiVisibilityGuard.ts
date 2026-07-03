import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import type { AiVisConfig } from './aiVisibility';

/** Gate AI Visibility sub-pages: no completed config ⇒ redirect to the wizard.
 * Returns { ready } true only once a completed config is confirmed, so pages
 * render a skeleton until then (never a flash of empty state). */
export function useAiVisibilityGuard(slug: string | undefined): { ready: boolean, config: AiVisConfig | null } {
   const router = useRouter();
   const { data, isFetching } = useQuery<{ config: AiVisConfig | null }>(
      ['ai-vis-config', slug],
      async () => {
         const r = await fetch(`/api/ai-visibility/${slug}/config`);
         return r.json();
      },
      { enabled: !!slug, staleTime: 30_000 },
   );
   const config = data?.config ?? null;
   useEffect(() => {
      // Decide only on a SETTLED fetch. Gating on isFetching (not isLoading) is the
      // fix for the post-setup bounce: right after "Finish", the config query holds
      // a stale { config: null } (cached when this guarded page was visited while
      // unconfigured). isLoading is false while that stale value is present, so the
      // effect used to redirect back to setup before the fresh (completed) config
      // landed. isFetching stays true until the refetch resolves.
      if (!slug || isFetching || data === undefined) return;
      if (!config?.completedAt) router.replace(`/sites/${slug}/ai-visibility/setup`);
   }, [slug, isFetching, data, config, router]);
   return { ready: !!config?.completedAt, config };
}
