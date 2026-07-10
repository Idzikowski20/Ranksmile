/* eslint-disable import/no-unresolved */
import type { NextPage } from 'next';
import Head from 'next/head';
// @ts-ignore
import { AuthView } from '@neondatabase/auth/react';
import AuthShell from '../../components/auth/AuthShell';

const PAGE_PATH = 'callback';

const AuthPage: NextPage = () => (
   <AuthShell>
      <Head><title>SerpBear</title></Head>
      <div style={{
         minHeight: '100vh',
         display: 'flex',
         alignItems: 'center',
         justifyContent: 'center',
         background: '#09090b',
      }}>
         <AuthView path={PAGE_PATH} redirectTo="/" />
      </div>
   </AuthShell>
);

export default AuthPage;
