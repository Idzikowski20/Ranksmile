import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';
import AuthPageLayout from '../../components/auth/AuthPageLayout';
import AuthShell from '../../components/auth/AuthShell';
import { useMarkEmailConfirmed } from '../../lib/emailConfirmedStatus';
import { Card } from '../../components/koala/product';
import Button from '../../components/koala/primitives/Button';
import { ErrorState, LoadingState } from '../../components/koala/feedback';

type ConfirmResult = { ok: boolean };
type Status = 'verifying' | 'error' | 'success';

const ConfirmEmail: NextPage = () => {
   const router = useRouter();
   const markConfirmed = useMarkEmailConfirmed();
   const [status, setStatus] = useState<Status>('verifying');
   const initialized = useRef<boolean>(false);

   useEffect(() => {
      if (!router.isReady || initialized.current) return;
      initialized.current = true;

      const { token } = router.query;
      if (typeof token !== 'string' || !token) {
         setStatus('error');
         return;
      }

      const verify = async () => {
         try {
            const res = await fetch('/api/confirm-account', {
               method: 'PUT',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ token }),
            });
            const data: ConfirmResult = await res.json();
            if (data.ok) {
               setStatus('success');
               markConfirmed(true);
               router.replace('/onboarding');
            } else {
               setStatus('error');
            }
         } catch {
            setStatus('error');
         }
      };

      void verify();
   }, [router.isReady, router.query, router, markConfirmed]);

   if (status === 'success') return null;

   return (
      <AuthShell>
         <Head><title>Confirm your e-mail - Ranksmile</title></Head>
         <AuthPageLayout>
            <Card elevated>
               {status === 'verifying' && <LoadingState label="Confirming…" />}
               {status === 'error' && (
                  <ErrorState
                     title="Link expired"
                     description="This confirmation link is invalid or has expired."
                     action={(
                        <Button
                           type="button"
                           variant="primary"
                           size="md"
                           onClick={() => router.push('/auth/confirm-account')}
                        >
                           Send a new link
                        </Button>
                     )}
                  />
               )}
            </Card>
         </AuthPageLayout>
      </AuthShell>
   );
};

export default ConfirmEmail;
