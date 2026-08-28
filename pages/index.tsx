import type { GetServerSideProps, NextPage } from 'next';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { NextApiRequest, NextApiResponse } from 'next';
import { dehydrate, QueryClient } from 'react-query';
import AppLoading from '../components/common/AppLoading';
import { PlanExpired } from '../components/billing/PlanExpired';
import { getCurrentUser } from '../utils/getUser';
import { getBootstrap } from '@/src/infrastructure/getBootstrap';
import type { BootstrapData } from '@/src/infrastructure/getBootstrap';
import { isPlanExpired } from '@/src/infrastructure/appAccess/isPlanExpired';
import { LandingPage } from '../components/landing/LandingPage';

type HomeProps = {
  dehydratedState?: unknown;
  /** SSR already knows the plan expired — render the block, skip the dispatch effect. */
  planExpired?: boolean;
  /** No session on the server — render the public marketing page, never dispatch. */
  landing?: boolean;
};

const Home: NextPage<HomeProps> = ({ planExpired = false, landing = false }) => {
  const router = useRouter();
  const [expired, setExpired] = useState(planExpired);

  useEffect(() => {
    if (!router || expired || landing) return;
    let stashed: string | null = null;
    try {
      stashed = localStorage.getItem('post_login_redirect');
      if (stashed) localStorage.removeItem('post_login_redirect');
    } catch { /* ignore */ }
    if (stashed) {
      router.replace(stashed);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/session/bootstrap');
        if (res.status === 401) {
          router.replace('/auth/sign-in');
          return;
        }
        if (!res.ok) {
          router.replace('/onboarding');
          return;
        }
        const bootstrap = await res.json() as BootstrapData;
        // "/" is Public, so ApplicationShell never gates it — this page is its own
        // dispatcher and needs the shell's exception too. Following the
        // BILLING_REQUIRED redirect here bounced an expired customer onto the pricing
        // page with no word of why; the block renders in place instead, and its own
        // links carry them to /plans.
        if (bootstrap.access && isPlanExpired(bootstrap.access)) {
          setExpired(true);
          return;
        }
        const to = bootstrap.redirectTo ?? bootstrap.access?.redirect?.redirect;
        if (to) {
          router.replace(to);
        }
      } catch {
        router.replace('/onboarding');
      }
    })();
  }, [router, expired, landing]);

  if (landing) return <LandingPage />;
  if (expired) return <PlanExpired />;

  return (
    <div>
      <Head>
        <title>Ranksmile</title>
        <meta name="description" content="Ranksmile Google Keyword Position Tracking App" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main role="main">
        <AppLoading />
      </main>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<HomeProps> = async (ctx) => {
  const req = ctx.req as NextApiRequest;
  const res = ctx.res as NextApiResponse;
  const user = await getCurrentUser(req, res);

  // Anonymous visitors get the marketing landing (SSR, indexable). Signed-in users
  // are dispatched to their workspace below exactly as before.
  if (!user) {
    return { props: { landing: true } };
  }

  const cookie = typeof req.cookies?.active_workspace === 'string'
    ? req.cookies.active_workspace
    : undefined;

  const bootstrap = await getBootstrap(user.id, {
    activeWorkspaceCookie: cookie,
    resolveRedirect: true,
    createSetupIfNeeded: true,
  });

  // Same exception as the client effect: an expired plan renders the block in place
  // rather than bouncing to /plans. Handled on the server too so a full page load of
  // "/" never flashes through the redirect.
  if (bootstrap.access && isPlanExpired(bootstrap.access)) {
    return { props: { planExpired: true } };
  }

  if (bootstrap.redirectTo ?? bootstrap.access?.redirect?.redirect) {
    return {
      redirect: {
        destination: bootstrap.redirectTo ?? bootstrap.access.redirect.redirect,
        permanent: false,
      },
    };
  }

  const queryClient = new QueryClient();
  queryClient.setQueryData(['bootstrap'], bootstrap);

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
  };
};

export default Home;
