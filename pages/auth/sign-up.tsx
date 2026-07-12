/* eslint-disable import/no-unresolved */
import type { NextPage } from 'next';
import Head from 'next/head';
// @ts-ignore
import { AuthView } from '@neondatabase/auth/react';
import AuthShell from '../../components/auth/AuthShell';

const SignUp: NextPage = () => (
   <AuthShell>
      <Head>
         <title>Sign up - SerpBear</title>
      </Head>
      <div style={{
         minHeight: '100vh',
         display: 'flex',
         alignItems: 'center',
         justifyContent: 'center',
         background: '#09090b',
      }}>
         <AuthView path="sign-up" redirectTo="/" />
      </div>
   </AuthShell>
);

export default SignUp;
