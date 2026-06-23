/* eslint-disable import/no-unresolved */
import '../styles/globals.css';
import React from 'react';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from 'react-query';
// @ts-ignore
import { NeonAuthUIProvider } from '@neondatabase/auth/react';
import { authClient } from '../lib/auth/client';

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
            <Component {...pageProps} />
         </QueryClientProvider>
      </NeonAuthUIProvider>
   );
}

export default MyApp;
