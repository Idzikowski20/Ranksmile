/* eslint-disable import/no-unresolved */
import '@neondatabase/auth-ui/css';
import type { NextPage } from 'next';
import Head from 'next/head';
// @ts-ignore
import { AuthView } from '@neondatabase/auth/react';

const SignIn: NextPage = () => (
   <>
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
   </>
);

export default SignIn;
