/* eslint-disable import/no-unresolved */
import '@neondatabase/auth-ui/css';
import type { NextPage } from 'next';
import Head from 'next/head';
// @ts-ignore
import { AuthView } from '@neondatabase/auth/react';

const ForgotPassword: NextPage = () => (
   <>
      <Head>
         <title>Reset password — SerpBear</title>
      </Head>
      <div style={{
         minHeight: '100vh',
         display: 'flex',
         alignItems: 'center',
         justifyContent: 'center',
         background: '#09090b',
      }}>
         <AuthView path="forgot-password" redirectTo="/auth/sign-in" />
      </div>
   </>
);

export default ForgotPassword;
