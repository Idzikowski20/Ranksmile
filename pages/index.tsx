import type { GetServerSideProps, NextPage } from 'next';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import type { NextApiRequest, NextApiResponse } from 'next';
import { dehydrate, QueryClient } from 'react-query';
import AppLoading from '../components/common/AppLoading';
import { getCurrentUser } from '../utils/getUser';
import { getBootstrap } from '../lib/getBootstrap';
import type { BootstrapData } from '../lib/getBootstrap';

const DigitXHomepage = dynamic(
  () => import('../components/marketing/digitx/DigitXHomepage'),
  { ssr: false, loading: () => <AppLoading /> },
);

type HomeProps = {
  marketing: boolean;
  dehydratedState?: unknown;
};

const Home: NextPage<HomeProps> = ({ marketing: marketingFromServer }) => {
  const router = useRouter();
  const [showMarketing, setShowMarketing] = useState(marketingFromServer);

  useEffect(() => {
    if (marketingFromServer) {
      setShowMarketing(true);
      return;
    }
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
          setShowMarketing(true);
          return;
        }
        if (!res.ok) {
          router.replace('/onboarding');
          return;
        }
        const bootstrap = await res.json() as BootstrapData;
        if (bootstrap.redirectTo) {
          router.replace(bootstrap.redirectTo);
          return;
        }
      } catch {
        router.replace('/onboarding');
      }
    })();
  }, [router, marketingFromServer]);

  if (showMarketing) {
    return (
      <>
        <Head>
          <title>DigitX | Digital Agency Portfolio</title>
          <meta
            name="description"
            content="DigitX delivers web design, development, and digital marketing solutions that drive business growth."
          />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600&display=swap"
            rel="stylesheet"
          />
        </Head>
        <DigitXHomepage />
      </>
    );
  }

  return (
    <div>
      <Head>
        <title>SerpBear</title>
        <meta name="description" content="SerpBear Google Keyword Position Tracking App" />
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
    return { props: { marketing: true } };
  }

  const cookie = typeof req.cookies?.active_workspace === 'string'
    ? req.cookies.active_workspace
    : undefined;

  const bootstrap = await getBootstrap(user.id, {
    activeWorkspaceCookie: cookie,
    resolveRedirect: true,
    createSetupIfNeeded: true,
  });

  if (bootstrap.redirectTo) {
    return {
      redirect: { destination: bootstrap.redirectTo, permanent: false },
    };
  }

  const queryClient = new QueryClient();
  queryClient.setQueryData(['bootstrap'], bootstrap);

  return {
    props: {
      marketing: false,
      dehydratedState: dehydrate(queryClient),
    },
  };
};

export default Home;
