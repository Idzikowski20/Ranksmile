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
            // No ready workspace. Onboarded users go straight into the workspace
            // creator (so they add their first domain); everyone else onboards first.
            const ob = await fetch('/api/onboarding')
               .then((r) => (r.ok ? r.json() : { completed: false }))
               .catch(() => ({ completed: false }));
            if (!ob.completed) { router.replace('/onboarding'); return; }
            // Onboarded with no ready workspace: owners/admins go to the creator; a member who
            // has lost (or never had) workspace access lands on a clear "no access" screen.
            const role: string | null = await fetch('/api/members')
               .then((r) => (r.ok ? r.json() : {}))
               .then((data: { role?: string | null }) => data.role ?? null)
               .catch(() => null);
            if (role !== 'owner' && role !== 'admin') { router.replace('/no-access'); return; }
            const created = await fetch('/api/workspaces/setup', { method: 'POST' })
               .then((r) => (r.ok ? r.json() : null))
               .catch(() => null);
            if (created?.id) { router.replace(`/workspace/${created.id}/setup`); return; }
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
