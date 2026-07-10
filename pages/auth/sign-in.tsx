/* eslint-disable import/no-unresolved */
import type { NextPage } from 'next';
import Head from 'next/head';
// @ts-ignore
import { AuthView } from '@neondatabase/auth/react';
import AuthShell from '../../components/auth/AuthShell';

const SignIn: NextPage = () => (
   <AuthShell>
      <Head>
         <title>Log in — SerpBear</title>
      </Head>
      <div style={{
         minHeight: '100vh',
         display: 'flex',
         alignItems: 'center',
         justifyContent: 'center',
         background: '#09090b',
      }}>
         <AuthView path="sign-in" redirectTo="/" />
      </div>
   </AuthShell>
);

export default SignIn;
