import type { NextPage } from 'next';
import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppLoading from '../components/common/AppLoading';

const Home: NextPage = () => {
   const router = useRouter();
   useEffect(() => {
      if (!router) return;
      let stashed: string | null = null;
      try { stashed = localStorage.getItem('post_login_redirect'); if (stashed) localStorage.removeItem('post_login_redirect'); } catch { /* ignore */ }
      if (stashed) { router.replace(stashed); return; }
      (async () => {
         try {
            const res = await fetch('/api/workspaces');
            const d = await res.json().catch(() => ({}));
            const first = (d.workspaces || [])[0];
            if (first?.id) { router.replace(`/workspace/${first.id}/dashboard`); return; }
         } catch { /* fall through */ }
         router.replace('/onboarding');
      })();
   }, [router]);

  return (
    <div>
      <Head>
        <title>SerpBear</title>
        <meta name="description" content="SerpBear Google Keyword Position Tracking App" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main role={'main'}>
        <AppLoading />
      </main>
    </div>
  );
};

export default Home;
