import type { GetServerSideProps, NextPage } from 'next';
import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { NextApiRequest, NextApiResponse } from 'next';
import { dehydrate, QueryClient } from 'react-query';
import AppLoading from '../components/common/AppLoading';
import { getCurrentUser } from '../utils/getUser';
import { getBootstrap } from '../lib/getBootstrap';
import type { BootstrapData } from '../lib/getBootstrap';

type HomeProps = {
  dehydratedState?: unknown;
};

const Home: NextPage<HomeProps> = () => {
  const router = useRouter();

  useEffect(() => {
    if (!router) return;
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
        const to = bootstrap.redirectTo ?? bootstrap.access?.redirect?.redirect;
        if (to) {
          router.replace(to);
        }
      } catch {
        router.replace('/onboarding');
      }
    })();
  }, [router]);

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

  if (!user) {
    return {
      redirect: { destination: '/auth/sign-in', permanent: false },
    };
  }

  const cookie = typeof req.cookies?.active_workspace === 'string'
    ? req.cookies.active_workspace
    : undefined;

  const bootstrap = await getBootstrap(user.id, {
    activeWorkspaceCookie: cookie,
    resolveRedirect: true,
    createSetupIfNeeded: true,
  });

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
