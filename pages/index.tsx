import type { NextPage } from 'next';
import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppLoading from '../components/common/AppLoading';

const Home: NextPage = () => {
   const router = useRouter();
   useEffect(() => {
      if (!router) return;
      let dest: string | null = null;
      try { dest = localStorage.getItem('post_login_redirect'); if (dest) localStorage.removeItem('post_login_redirect'); } catch { /* ignore */ }
      router.replace(dest || '/dashboard');
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
