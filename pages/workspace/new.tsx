import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import AppLoading from '../../components/common/AppLoading';

/**
 * Thin entry after billing entitlement — reuse setup workspace or create one, then enter setup UI.
 */
const WorkspaceNewPage: NextPage = () => {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!router.isReady || started.current) return;
    started.current = true;

    (async () => {
      try {
        const res = await fetch('/api/workspaces/setup', { method: 'POST' });
        if (res.status === 402) {
          const body = await res.json().catch(() => ({})) as { redirect?: string };
          void router.replace(body.redirect ?? '/plans');
          return;
        }
        if (!res.ok) {
          void router.replace('/plans');
          return;
        }
        const data = await res.json() as { id?: number };
        if (data.id) {
          void router.replace(`/workspace/${data.id}/setup`);
          return;
        }
        void router.replace('/plans');
      } catch {
        void router.replace('/plans');
      }
    })();
  }, [router]);

  return (
    <>
      <Head>
        <title>Create workspace · Ranksmile</title>
        <meta name="robots" content="noindex" />
      </Head>
      <AppLoading />
    </>
  );
};

export default WorkspaceNewPage;
