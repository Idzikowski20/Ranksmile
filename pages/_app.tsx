/* eslint-disable import/no-unresolved */
import '../styles/globals.css';
import React from 'react';
import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { QueryClient, QueryClientProvider, useQuery } from 'react-query';
import { Hydrate } from 'react-query/hydration';
import { ThemeProvider } from '@emotion/react';
import { fetchBootstrapOrNull } from '../lib/fetchBootstrap';
import { isPublicPath } from '../lib/isPublicPath';
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
   const path = router.pathname;
   const isPublic = isPublicPath(path);
   const [completedOverride, setCompleted] = React.useState<boolean | null>(null);
   const [confirmedOverride, setConfirmed] = React.useState<boolean | null>(null);
   // Latch so a mid-session refetch (Neon Auth / react-query) never re-shows the
   // full-screen loader after the app has already rendered once.
   const everHadUser = React.useRef(false);
   const everHadBootstrap = React.useRef(false);

   const { data: bootstrap, isLoading: bootstrapLoading, isFetched } = useQuery(
      ['bootstrap'],
      fetchBootstrapOrNull,
      { enabled: !isPublic, staleTime: BOOTSTRAP_STALE_MS, retry: false },
   );

   const hasSession = !!bootstrap;
   const isPending = !isPublic && bootstrapLoading;

   if (hasSession) everHadUser.current = true;
   if (bootstrap) everHadBootstrap.current = true;

   const completed = completedOverride ?? (bootstrap ? bootstrap.onboarding.completed : null);
   const confirmed = confirmedOverride ?? (bootstrap ? bootstrap.email.confirmed : null);

   const isOnboarding = path === '/onboarding';
   const isConfirmPage = path === '/auth/confirm-account' || path === '/auth/confirm-email';

   React.useEffect(() => {
      if (isPublic || isPending) return;
      if (!hasSession && isFetched) router.replace('/auth/sign-in');
   }, [isPublic, isPending, hasSession, isFetched, router]);

   React.useEffect(() => {
      if (!hasSession || confirmed === null) return;
      if (!confirmed && !isPublic) router.replace('/auth/confirm-account');
      if (confirmed && isConfirmPage) router.replace('/');
   }, [hasSession, confirmed, isPublic, isConfirmPage, router]);

   React.useEffect(() => {
      if (!hasSession || completed === null) return;
      if (!completed && !isOnboarding && !isPublic) router.replace('/onboarding');
   }, [hasSession, completed, isOnboarding, isPublic, router]);

   const isPlans = path === '/plans';
   const isSetup = path === '/setup';
   const isIndex = path === '/';
   const wsRedirecting = React.useRef(false);
   React.useEffect(() => {
      if (!hasSession || completed !== true || !bootstrap) return undefined;
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
   }, [hasSession, completed, bootstrap, isOnboarding, isPublic, isPlans, isSetup, isIndex, router]);

   if (!isPublic && !everHadUser.current && isPending) {
      return <AppLoading />;
   }
   if (!isPublic && !isPending && !hasSession && !everHadUser.current && isFetched) {
      return <AppLoading />;
   }
   if (hasSession && bootstrapLoading && !bootstrap && !everHadBootstrap.current) {
      return <AppLoading />;
   }
   if (hasSession && !isPublic && confirmed === false) {
      return <AppLoading />;
   }
   if (hasSession && !isPublic && completed === false && !isOnboarding) {
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
