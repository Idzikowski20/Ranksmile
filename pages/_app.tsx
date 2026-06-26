/* eslint-disable import/no-unresolved */
import '../styles/globals.css';
import React from 'react';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from 'react-query';
// @ts-ignore
import { NeonAuthUIProvider } from '@neondatabase/auth/react';
import { useRouter } from 'next/router';
import { authClient } from '../lib/auth/client';
import AppToaster from '../components/common/AppToaster';
import { parseWorkspaceId } from '../lib/activeWorkspace';

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

function MyApp({ Component, pageProps }: AppProps) {
   const [queryClient] = React.useState(() => new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
        },
      },
    }));
   return (
      <NeonAuthUIProvider authClient={authClient} redirectTo="/" basePath="/auth">
         <QueryClientProvider client={queryClient}>
            <WorkspaceCookieSync />
            <Component {...pageProps} />
            <AppToaster />
         </QueryClientProvider>
      </NeonAuthUIProvider>
   );
}

export default MyApp;
