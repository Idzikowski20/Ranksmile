/* eslint-disable import/no-unresolved */
import '../styles/globals.css';
import React from 'react';
import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { QueryClient, QueryClientProvider, useQuery } from 'react-query';
import { Hydrate } from 'react-query/hydration';
import { ThemeProvider } from '@emotion/react';
import { authClient } from '../lib/auth/client';
import type { BootstrapData } from '../lib/getBootstrap';
import AppToaster from '../components/common/AppToaster';
import AppLoading from '../components/common/AppLoading';
import TopProgressBar from '../components/common/TopProgressBar';
import { OnboardingStatusContext } from '../lib/onboardingStatus';
import { EmailConfirmedStatusContext } from '../lib/emailConfirmedStatus';
import { parseWorkspaceId } from '../lib/activeWorkspace';
import { theme } from '../components/core/theme';
import { IconDefaultsProvider } from '../components/core/IconDefaultsProvider';

const GlobalSmoothCaret = dynamic(
  () => import('../components/common/GlobalSmoothCaret'),
  { ssr: false },
);

const BOOTSTRAP_STALE_MS = 5 * 60_000;

async function fetchBootstrap(): Promise<BootstrapData> {
  const r = await fetch('/api/session/bootstrap');
  if (!r.ok) throw new Error('bootstrap failed');
  return r.json() as Promise<BootstrapData>;
}

/** Keeps the `active_workspace` cookie in sync with the /workspace/<id>/... URL so server-side scoping matches. */
function WorkspaceCookieSync() {
   const router = useRouter();
   React.useEffect(() => {
      const sync = (asPath: string) => {
         const id = parseWorkspaceId(asPath);
         if (id) document.cookie = `active_workspace=${id}; Path=/; Max-Age=31536000; SameSite=Lax`;
      };
      sync(router.asPath);
      router.events.on('routeChangeComplete', sync);
      return () => router.events.off('routeChangeComplete', sync);
   }, [router]);
   return null;
}

/**
 * Blocks every protected route until the logged-in user has finished onboarding.
 * Onboarding state lives in the DB (GET /api/session/bootstrap) — not in the session.
 */
function OnboardingGuard({ children }: { children: React.ReactNode }) {
   const router = useRouter();
   const { data: session, isPending } = authClient.useSession();
   const userId: string | undefined = session?.user?.id;
   const [completedOverride, setCompleted] = React.useState<boolean | null>(null);
   const [confirmedOverride, setConfirmed] = React.useState<boolean | null>(null);

   const { data: bootstrap, isLoading: bootstrapLoading } = useQuery(
      ['bootstrap'],
      fetchBootstrap,
      { enabled: !!userId, staleTime: BOOTSTRAP_STALE_MS, retry: false },
   );

   const completed = completedOverride ?? (bootstrap ? bootstrap.onboarding.completed : null);
   const confirmed = confirmedOverride ?? (bootstrap ? bootstrap.email.confirmed : null);

   const path = router.pathname;
   const isOnboarding = path === '/onboarding';
   const isConfirmPage = path === '/auth/confirm-account' || path === '/auth/confirm-email';
   const isPublic = path.startsWith('/auth') || path.startsWith('/login') || path.startsWith('/drafts') || path.startsWith('/invite') || path === '/' || path === '/homepage';

   React.useEffect(() => {
      if (isPending) return;
      if (!userId && !isPublic) router.replace('/auth/sign-in');
   }, [isPending, userId, isPublic, router]);

   React.useEffect(() => {
      if (!userId || confirmed === null) return;
      if (!confirmed && !isPublic) router.replace('/auth/confirm-account');
      if (confirmed && isConfirmPage) router.replace('/');
   }, [userId, confirmed, isPublic, isConfirmPage, router]);

   React.useEffect(() => {
      if (!userId || completed === null) return;
      if (!completed && !isOnboarding && !isPublic) router.replace('/onboarding');
   }, [userId, completed, isOnboarding, isPublic, router]);

   const isPlans = path === '/plans';
   const isSetup = path === '/setup';
   const isIndex = path === '/';
   const wsRedirecting = React.useRef(false);
   React.useEffect(() => {
      if (!userId || completed !== true || !bootstrap) return undefined;
      if (isOnboarding || isPublic || isPlans || isSetup || isIndex || wsRedirecting.current) return undefined;
      if (bootstrap.workspaces.length > 0) return undefined;
      if (!bootstrap.canCreateSetup) return undefined;
      let active = true;
      (async () => {
         const created = await fetch('/api/workspaces/setup', { method: 'POST' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
         if (active && created?.id) {
            wsRedirecting.current = true;
            router.replace(`/workspace/${created.id}/setup`);
         }
      })();
      return () => { active = false; };
   }, [userId, completed, bootstrap, isOnboarding, isPublic, isPlans, isSetup, isIndex, router]);

   if (!isPending && !userId && !isPublic) {
      return <AppLoading />;
   }
   if (userId && bootstrapLoading && !bootstrap) {
      return <AppLoading />;
   }
   if (userId && !isPublic && confirmed === false) {
      return <AppLoading />;
   }
   if (userId && !isPublic && completed === false && !isOnboarding) {
      return <AppLoading />;
   }

   return (
      <EmailConfirmedStatusContext.Provider value={setConfirmed}>
         <OnboardingStatusContext.Provider value={setCompleted}>{children}</OnboardingStatusContext.Provider>
      </EmailConfirmedStatusContext.Provider>
   );
}

type AppPageProps = AppProps['pageProps'] & { dehydratedState?: unknown };

function MyApp({ Component, pageProps }: AppProps) {
   const { dehydratedState, ...restPageProps } = pageProps as AppPageProps;
   const [queryClient] = React.useState(() => new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
        },
      },
    }));
    return (
       <QueryClientProvider client={queryClient}>
          <Hydrate state={dehydratedState}>
             <ThemeProvider theme={theme}>
                <IconDefaultsProvider size="sm">
                   <TopProgressBar />
                   <WorkspaceCookieSync />
                   <OnboardingGuard>
                      <Component {...restPageProps} />
                   </OnboardingGuard>
                   <AppToaster />
                   <GlobalSmoothCaret />
                </IconDefaultsProvider>
             </ThemeProvider>
          </Hydrate>
       </QueryClientProvider>
    );
}

export default MyApp;
