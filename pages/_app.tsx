/* eslint-disable import/no-unresolved */
import '../styles/globals.css';
import React from 'react';
import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { QueryClient, QueryClientProvider, useQuery } from 'react-query';
import { Hydrate } from 'react-query/hydration';
import { ThemeProvider } from '@emotion/react';
import posthog from 'posthog-js';
import { fetchBootstrapOrNull } from '../lib/fetchBootstrap';
import { isPublicPath } from '../lib/isPublicPath';
import { isFrontendRouteAllowedDuringPaymentLock } from '../lib/paymentFailedLock';
import type { SubscriptionDetails } from '../lib/subscriptionDetails';
import AppToaster from '../components/common/AppToaster';
import AppLoading from '../components/common/AppLoading';
import TopProgressBar from '../components/common/TopProgressBar';
import { OnboardingStatusContext } from '../lib/onboardingStatus';
import { EmailConfirmedStatusContext } from '../lib/emailConfirmedStatus';
import { parseWorkspaceId } from '../lib/activeWorkspace';
import { theme } from '../components/core/theme';
import { IconDefaultsProvider } from '../components/core/IconDefaultsProvider';

if (typeof window !== 'undefined') {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(
        'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, '
        + 'this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
      );
    }
  } else {
    posthog.init(token, {
      api_host: '/ingest',
      ui_host: 'https://eu.posthog.com',
      defaults: '2026-01-30',
      capture_exceptions: true,
      capture_pageview: false,
      debug: process.env.NODE_ENV === 'development',
    });
  }
}

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
 *
 * Important: only `bootstrap === null` (HTTP 401) means signed out.
 * A thrown/network/5xx failure must NOT be treated as signed-out — that left the app
 * stuck on AppLoading after a single failed fetch (common during next.js compile/HMR).
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

   const {
      data: bootstrap,
      isLoading: bootstrapLoading,
      isFetched,
      isError,
      isFetching,
      refetch,
   } = useQuery(
      ['bootstrap'],
      fetchBootstrapOrNull,
      {
         enabled: !isPublic,
         staleTime: BOOTSTRAP_STALE_MS,
         // Transient 5xx/HTML-during-compile is common in `next dev`; don't give up after 1 try.
         retry: 3,
         retryDelay: (n) => Math.min(1000 * (n + 1), 3000),
      },
   );

   // null = explicit 401 (signed out). undefined = still loading or error (not signed out).
   const hasSession = bootstrap != null;
   const signedOut = isFetched && !isError && bootstrap === null;
   const isPending = !isPublic && (bootstrapLoading || (isFetching && bootstrap === undefined));

   if (hasSession) everHadUser.current = true;
   if (bootstrap) everHadBootstrap.current = true;

   React.useEffect(() => {
      if (!bootstrap?.userId) return;
      posthog.identify(bootstrap.userId, {
         email: bootstrap.email.email ?? undefined,
      });
   }, [bootstrap?.userId, bootstrap?.email.email]);

   const completed = completedOverride ?? (bootstrap ? bootstrap.onboarding.completed : null);
   const confirmed = confirmedOverride ?? (bootstrap ? bootstrap.email.confirmed : null);

   const isOnboarding = path === '/onboarding';
   const isConfirmPage = path === '/auth/confirm-account' || path === '/auth/confirm-email';

   React.useEffect(() => {
      if (isPublic || isPending) return;
      if (signedOut) router.replace('/auth/sign-in');
   }, [isPublic, isPending, signedOut, router]);

   // Recover from bootstrap fetch failures instead of trapping the UI on AppLoading.
   React.useEffect(() => {
      if (isPublic || !isError || hasSession) return undefined;
      const t = window.setTimeout(() => { void refetch(); }, 1500);
      return () => window.clearTimeout(t);
   }, [isPublic, isError, hasSession, refetch]);

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

   if (!isPublic && !everHadUser.current && (isPending || isError)) {
      return <AppLoading />;
   }
   if (!isPublic && signedOut && !everHadUser.current) {
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

function PaymentFailedLockGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isPublic = isPublicPath(router.pathname);

  const { data } = useQuery(
    'subscriptionDetails',
    async () => {
      const res = await fetch('/api/billing/subscription');
      if (!res.ok) throw new Error('Failed to load subscription');
      return res.json() as Promise<{ subscription: SubscriptionDetails }>;
    },
    {
      enabled: !isPublic,
      staleTime: 30 * 1000,
      retry: false,
    },
  );

  const paymentFailedLocked = data?.subscription?.paymentFailedLocked === true;

  React.useEffect(() => {
    if (isPublic) return;
    if (!paymentFailedLocked) return;
    const allowed = isFrontendRouteAllowedDuringPaymentLock(router.asPath);
    if (!allowed) router.replace('/plans?reason=payment_failed');
  }, [isPublic, paymentFailedLocked, router, router.asPath]);

  return <>{children}</>;
}

type AppPageProps = AppProps['pageProps'] & { dehydratedState?: unknown };

function MyApp({ Component, pageProps }: AppProps) {
   const { dehydratedState, ...restPageProps } = pageProps as AppPageProps;
   const router = useRouter();
   const [queryClient] = React.useState(() => new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
        },
      },
    }));

   React.useEffect(() => {
      posthog.capture('$pageview');
      const handleRouteChange = () => posthog.capture('$pageview');
      router.events.on('routeChangeComplete', handleRouteChange);
      return () => router.events.off('routeChangeComplete', handleRouteChange);
   }, [router.events]);

    return (
       <QueryClientProvider client={queryClient}>
          <Hydrate state={dehydratedState}>
             <ThemeProvider theme={theme}>
                <IconDefaultsProvider size="sm">
                   <TopProgressBar />
                   <WorkspaceCookieSync />
                   <OnboardingGuard>
                      <PaymentFailedLockGuard>
                        <Component {...restPageProps} />
                      </PaymentFailedLockGuard>
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
