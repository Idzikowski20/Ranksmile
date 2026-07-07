import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { useWorkspaces } from '../services/workspaces';
import { useFetchDomains } from '../services/domains';
import { deriveActiveId, workspaceHref } from './activeWorkspace';

export interface OnboardingStep {
   key: string;
   label: string;
   done: boolean;
   time?: string;
   href?: string; // where the step's CTA / row navigates
   cta?: string;  // dashboard "next step" button label
}

const getJson = <T, >(url: string): Promise<T | null> => fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : null));

/**
 * The "Get started" onboarding checklist, derived from real signals and shared by the
 * sidebar launchpad and the dashboard next-step card. Reuses the dashboard/sidebar
 * react-query keys so the cache is shared.
 */
export function useOnboardingChecklist(): {
   steps: OnboardingStep[];
   beyondSteps: OnboardingStep[];
   done: number;
   total: number;
   pct: number;
   nextStep: OnboardingStep | null;
   loading: boolean;
} {
   const router = useRouter();
   const { data: wsData } = useWorkspaces();
   const { data: domainsData, isLoading: domainsLoading } = useFetchDomains({} as never);
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   const wsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
   const slug = domainsData?.domains?.[0]?.slug ?? null;

   const { data: sitesData, isLoading: sitesLoading } = useQuery('dashboardSites', () => getJson<{ sites?: unknown[] }>('/api/sites'), { staleTime: 5 * 60 * 1000, retry: false });
   const { data: recsData, isLoading: recsLoading } = useQuery(['domainRecs', slug], () => getJson<{ recommendations?: unknown[] }>(`/api/domains/${slug}/recommendations`), { enabled: !!slug, staleTime: 60 * 1000 });
   const { data: articlesData, isLoading: articlesLoading } = useQuery('dashboardArticles', () => getJson<{ articles?: Array<{ source?: string; title?: string }> }>('/api/articles'));
   // "See if AI mentions your brand" flips done once the AI Visibility scan finishes
   // (status 'completed' = the crunching bar is done and results are in the overview).
   const { data: aiStatus, isLoading: aiLoading } = useQuery(['aiVisStatusOnboarding', slug], () => getJson<{ status?: string }>(`/api/ai-visibility/${slug}/scan-status`), { enabled: !!slug, staleTime: 60 * 1000 });

   // Until the real signals resolve, every step reads as not-done. Surfacing that
   // (0% → animating up → hide) is the "fills up then vanishes" flash the user saw,
   // so consumers should wait for `loading` to clear before rendering.
   // The `slug`-based queries (recs/AI) are disabled until the domains query resolves,
   // so we must also wait on `domainsLoading` — otherwise `loading` reads false during
   // the window where domains haven't loaded yet, the card renders with empty data, and
   // then flips once `slug` appears. `domainsLoading` clears as soon as domains resolve,
   // including the "loaded but zero domains" case (slug stays null), so this never hangs.
   const loading = !wsData || domainsLoading || sitesLoading || articlesLoading || (!!slug && (recsLoading || aiLoading));

   return useMemo(() => {
      const ws = (p: string) => workspaceHref(wsId, p);
      const hasWorkspace = (wsData?.workspaces?.length ?? 0) > 0;          // first workspace created
      const hasGsc = (sitesData?.sites?.length ?? 0) > 0;                  // a GSC account is connected
      const hasAudit = (recsData?.recommendations?.length ?? 0) > 0;       // the domain scan produced recs
      const hasArticle = (articlesData?.articles ?? []).some((a) => a.source !== 'site_context' && !!a.title); // real content exists
      const hasAiResults = aiStatus?.status === 'completed';                 // AI Visibility scan finished
      const steps: OnboardingStep[] = [
         { key: 'workspace', label: 'Set up your workspace', done: hasWorkspace },
         { key: 'gsc', label: 'Connect Google Search Console', done: hasGsc },
         { key: 'audit', label: 'Audit existing content and find quick wins', done: hasAudit, href: ws(slug ? `/sites/${slug}/recommendations` : '/dashboard'), cta: 'View recommendations' },
         { key: 'ai', label: 'See if AI mentions your brand', done: hasAiResults, time: '2m', href: ws('/ai_tracker?intent=overview'), cta: 'See AI Visibility' },
         { key: 'content', label: 'Create content that ranks in AI Search and SEO', done: hasArticle, time: '10m', href: ws('/articles'), cta: 'Open Content Editor' },
      ];
      const beyondSteps: OnboardingStep[] = [
         { key: 'topical', label: 'Build a topical map for your niche', done: false, href: ws(slug ? `/sites/${slug}/topical-map` : '/dashboard') },
         { key: 'wordpress', label: 'Connect WordPress for publishing', done: false, href: '/settings/wordpress' },
         { key: 'api', label: 'Explore the API for custom workflows', done: false, href: '/settings/api' },
      ];
      const done = steps.filter((s) => s.done).length;
      const total = steps.length;
      const pct = Math.round((done / total) * 100);
      const nextStep = steps.find((s) => !s.done) ?? null;
      return { steps, beyondSteps, done, total, pct, nextStep, loading };
   }, [wsId, slug, wsData, sitesData, recsData, articlesData, aiStatus, loading]);
}
