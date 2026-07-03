import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import type { AiVisConfig } from './aiVisibility';

/** Gate AI Visibility sub-pages: no completed config ⇒ redirect to the wizard.
 * Returns { ready } true only once a completed config is confirmed, so pages
 * render a skeleton until then (never a flash of empty state). */
export function useAiVisibilityGuard(slug: string | undefined): { ready: boolean, config: AiVisConfig | null } {
   const router = useRouter();
   const { data, isLoading } = useQuery<{ config: AiVisConfig | null }>(
      ['ai-vis-config', slug],
      async () => {
         const r = await fetch(`/api/ai-visibility/${slug}/config`);
         return r.json();
      },
      { enabled: !!slug, staleTime: 30_000 },
   );
   const config = data?.config ?? null;
   useEffect(() => {
      if (!slug || isLoading || data === undefined) return;
      if (!config?.completedAt) router.replace(`/sites/${slug}/ai-visibility/setup`);
   }, [slug, isLoading, data, config, router]);
   return { ready: !!config?.completedAt, config };
}
