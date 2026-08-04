/* eslint-disable import/no-unresolved */
import '../styles/globals.css';
import '../styles/cursors.css';
import React from 'react';
import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Hydrate } from 'react-query/hydration';
import { parseWorkspaceId } from '../lib/activeWorkspace';
import { IconDefaultsProvider } from '../components/koala/core/IconDefaultsProvider';
import { KoalaThemeProvider } from '../components/koala/theme';
import AppToaster from '../components/common/AppToaster';
import TopProgressBar from '../components/common/TopProgressBar';
import { ApplicationShell } from '../lib/appAccess/ApplicationShell';

const GlobalSmoothCaret = dynamic(
  () => import('../components/common/GlobalSmoothCaret'),
  { ssr: false },
);

/** Keeps the `active_workspace` cookie in sync with the /workspace/<id>/... URL. */
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
        <KoalaThemeProvider>
          <IconDefaultsProvider size="sm">
            <TopProgressBar />
            <WorkspaceCookieSync />
            <ApplicationShell>
              <Component {...restPageProps} />
            </ApplicationShell>
            <AppToaster />
            <GlobalSmoothCaret />
          </IconDefaultsProvider>
        </KoalaThemeProvider>
      </Hydrate>
    </QueryClientProvider>
  );
}

export default MyApp;
