/* eslint-disable import/no-unresolved */
import '../styles/globals.css';
import React from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider } from '@emotion/react';
// @ts-ignore
import { NeonAuthUIProvider } from '@neondatabase/auth/react';
import { authClient } from '../lib/auth/client';
import AppToaster from '../components/common/AppToaster';
import GlobalSmoothCaret from '../components/common/GlobalSmoothCaret';
import AppLoading from '../components/common/AppLoading';
import TopProgressBar from '../components/common/TopProgressBar';
import { OnboardingStatusContext } from '../lib/onboardingStatus';
import { EmailConfirmedStatusContext } from '../lib/emailConfirmedStatus';
import { parseWorkspaceId } from '../lib/activeWorkspace';
import { useGSAP } from '@gsap/react';
import { registerMotionPlugins } from '../lib/motion/gsap';
import { theme } from '../components/core/theme';
import { IconDefaultsProvider } from '../components/core/IconDefaultsProvider';

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
 * Onboarding state lives in the DB (GET /api/onboarding) — not in the session.
 */
function OnboardingGuard({ children }: { children: React.ReactNode }) {
   const router = useRouter();
   const { data: session, isPending } = authClient.useSession();
   const userId: string | undefined = session?.user?.id;
   const [completed, setCompleted] = React.useState<boolean | null>(null);
   const [confirmed, setConfirmed] = React.useState<boolean | null>(null);

   const path = router.pathname;
   const isOnboarding = path === '/onboarding';
   const isConfirmPage = path === '/auth/confirm-account' || path === '/auth/confirm-email';
   // Auth + public read-only routes are never gated. /invite handles its own
   // session (lets an anonymous invitee stash the token before signing in).
   const isPublic = path.startsWith('/auth') || path.startsWith('/login') || path.startsWith('/drafts') || path.startsWith('/invite');

   // Not signed in → send to auth login. Onboarding and every app route are for
   // authenticated users only; public routes (auth, invite, drafts) stay open.
   React.useEffect(() => {
      if (isPending) return;
      if (!userId && !isPublic) router.replace('/auth/sign-in');
   }, [isPending, userId, isPublic, router]);

   // Fetch onboarding state whenever the signed-in user changes.
   React.useEffect(() => {
      let active = true;
      if (!userId) { setCompleted(null); return undefined; }
      fetch('/api/onboarding')
         .then((r) => (r.ok ? r.json() : { completed: false }))
         .then((d) => { if (active) setCompleted(!!d.completed); })
         .catch(() => { if (active) setCompleted(false); });
      return () => { active = false; };
   }, [userId]);

   // Fetch email-confirmation state whenever the signed-in user changes. Fail OPEN (not gated)
   // on a non-ok response or network error — unlike the onboarding fetch, a transient blip here
   // would bounce EVERY signed-in user to /auth/confirm-account and trigger a resend email; only
   // a genuine 200 { confirmed:false } from the server should gate.
   React.useEffect(() => {
      let active = true;
      if (!userId) { setConfirmed(null); return undefined; }
      fetch('/api/confirm-account')
         .then((r) => (r.ok ? r.json() : null))
         .then((d) => { if (active) setConfirmed(d === null ? true : !!d.confirmed); })
         .catch(() => { if (active) setConfirmed(true); });
      return () => { active = false; };
   }, [userId]);

   // Enforce the confirm gate once state is known: an unconfirmed user can't reach
   // any protected route (including /onboarding). A confirmed user landing on the
   // confirm page itself is sent home.
   React.useEffect(() => {
      if (!userId || confirmed === null) return;
      if (!confirmed && !isPublic) router.replace('/auth/confirm-account');
      if (confirmed && isConfirmPage) router.replace('/');
   }, [userId, confirmed, isPublic, isConfirmPage, router]);

   // Enforce the gate once state is known: not-yet-onboarded users can't reach
   // protected routes. Leaving /onboarding after finishing is handled by the page
   // itself (router.replace('/plans')) to avoid racing redirects.
   React.useEffect(() => {
      if (!userId || completed === null) return;
      if (!completed && !isOnboarding && !isPublic) router.replace('/onboarding');
   }, [userId, completed, isOnboarding, isPublic, router]);

   // Once onboarded, a user with NO workspace must ALWAYS land in the creator —
   // covers /plans "skip", direct /dashboard, anything that bypasses index's redirect.
   const isPlans = path === '/plans';
   const isSetup = path === '/setup'; // the creator, served via the /workspace/<id>/setup rewrite
   const isIndex = path === '/';
   const wsRedirecting = React.useRef(false);
   React.useEffect(() => {
      if (!userId || completed !== true) return undefined;
      if (isOnboarding || isPublic || isPlans || isSetup || isIndex || wsRedirecting.current) return undefined;
      let active = true;
      (async () => {
         const ws = await fetch('/api/workspaces')
            .then((r) => (r.ok ? r.json() : { workspaces: [] }))
            .catch(() => ({ workspaces: [] }));
         if (!active || (ws.workspaces || []).length > 0) return;
         const created = await fetch('/api/workspaces/setup', { method: 'POST' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
         if (active && created?.id) { wsRedirecting.current = true; router.replace(`/workspace/${created.id}/setup`); }
      })();
      return () => { active = false; };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [userId, completed, path]);

   // Only hold the route once we KNOW onboarding isn't done (→ redirecting).
   // While still resolving (completed === null) we render normally, so there's no
   // full-screen loader flash on every page load — only the sign-in transition.
   if (!isPending && !userId && !isPublic) {
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

function MyApp({ Component, pageProps }: AppProps) {
   const [queryClient] = React.useState(() => new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
        },
      },
    }));
   // Register every GSAP plugin once, client-side (motion layer — see lib/motion/gsap.ts).
   useGSAP(() => { registerMotionPlugins(); });
    return (
       <NeonAuthUIProvider authClient={authClient} redirectTo="/" basePath="/auth">
          <QueryClientProvider client={queryClient}>
             <ThemeProvider theme={theme}>
                <IconDefaultsProvider size="sm">
                   <TopProgressBar />
                   <WorkspaceCookieSync />
                   <OnboardingGuard>
                      <Component {...pageProps} />
                   </OnboardingGuard>
                   <AppToaster />
                   <GlobalSmoothCaret />
                </IconDefaultsProvider>
             </ThemeProvider>
          </QueryClientProvider>
       </NeonAuthUIProvider>
    );
}

export default MyApp;
