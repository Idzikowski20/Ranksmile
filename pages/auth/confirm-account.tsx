import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';
import AuthPageLayout from '../../components/auth/AuthPageLayout';
import AuthShell from '../../components/auth/AuthShell';
import { authSubtitleStyle, authTitleStyle } from '../../components/auth/authStyles';
import { signOut } from '../../lib/auth/fetchAuth';
import { useMarkEmailConfirmed } from '../../lib/emailConfirmedStatus';
import { Card } from '../../components/koala/product';
import Button from '../../components/koala/primitives/Button';
import { LoadingState } from '../../components/koala/feedback';

type ConfirmStatus = { confirmed: boolean; email?: string };
type SendResult = { sent?: boolean; confirmed?: boolean; cooldownMs?: number };

const ConfirmAccount: NextPage = () => {
   const router = useRouter();
   const markConfirmed = useMarkEmailConfirmed();
   const [email, setEmail] = useState<string>('');
   const [cooldown, setCooldown] = useState<number>(0);
   const [sent, setSent] = useState<boolean>(false);
   const [ready, setReady] = useState(false);
   const initialized = useRef<boolean>(false);
   const cooldownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
   const sentTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

   const startCooldown = (cooldownMs: number) => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
      setCooldown(Math.ceil(cooldownMs / 1000));
      cooldownInterval.current = setInterval(() => {
         setCooldown((prev) => {
            if (prev <= 1) {
               if (cooldownInterval.current) clearInterval(cooldownInterval.current);
               return 0;
            }
            return prev - 1;
         });
      }, 1000);
   };

   useEffect(() => {
      if (!initialized.current) {
         initialized.current = true;

         const init = async () => {
            try {
               const statusRes = await fetch('/api/confirm-account');
               const status: ConfirmStatus = await statusRes.json();
               if (status.confirmed) {
                  markConfirmed(true);
                  router.replace('/onboarding');
                  return;
               }
               if (status.email) setEmail(status.email);

               const sendRes = await fetch('/api/confirm-account', { method: 'POST' });
               if (sendRes.status === 429) {
                  const data: SendResult = await sendRes.json();
                  if (data.cooldownMs) startCooldown(data.cooldownMs);
                  return;
               }
               const data: SendResult = await sendRes.json();
               if (data.confirmed) {
                  markConfirmed(true);
                  router.replace('/onboarding');
               }
            } catch {
               // network error on initial load — user can still use "Resend email" manually.
            } finally {
               setReady(true);
            }
         };

         void init();
      }

      return () => {
         if (cooldownInterval.current) clearInterval(cooldownInterval.current);
         if (sentTimeout.current) clearTimeout(sentTimeout.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   const handleResend = async () => {
      if (cooldown > 0) return;
      try {
         const res = await fetch('/api/confirm-account', { method: 'POST' });
         if (res.status === 429) {
            const data: SendResult = await res.json();
            if (data.cooldownMs) startCooldown(data.cooldownMs);
            return;
         }
         const data: SendResult = await res.json();
         if (data.confirmed) {
            markConfirmed(true);
            router.replace('/onboarding');
            return;
         }
         if (data.sent) {
            setSent(true);
            if (sentTimeout.current) clearTimeout(sentTimeout.current);
            sentTimeout.current = setTimeout(() => setSent(false), 2000);
         }
      } catch {
         // ignore — user can retry the click.
      }
   };

   const handleSignOut = async () => {
      await signOut();
      router.replace('/auth/sign-in');
   };

   let resendLabel = 'Resend email';
   if (cooldown > 0) {
      resendLabel = `Resend email (${cooldown}s)`;
   } else if (sent) {
      resendLabel = 'Sent!';
   }
   const resendDisabled = cooldown > 0;

   return (
      <AuthShell>
         <Head><title>Confirm your e-mail - Ranksmile</title></Head>
         <AuthPageLayout>
            <Card elevated style={{ border: 'none' }}>
               {!ready ? (
                  <LoadingState label="Sending confirmation email…" />
               ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
                     <h1 style={authTitleStyle}>Check your e-mail</h1>
                     <p style={{ ...authSubtitleStyle, margin: 0, maxWidth: 420 }}>
                        {email ? (
                           <>We sent a temporary link to <strong style={{ fontWeight: 700, color: '#1a1a1a' }}>{email}</strong>.</>
                        ) : (
                           'We sent a temporary link to your e-mail address.'
                        )}
                        {' '}Please check your Spam folder as well.
                     </p>
                     <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 }}>
                        <Button
                           type="button"
                           variant="primary"
                           size="md"
                           onClick={handleResend}
                           disabled={resendDisabled}
                        >
                           {resendLabel}
                        </Button>
                        <Button type="button" variant="transparent" size="md" onClick={handleSignOut}>
                           Sign out
                        </Button>
                     </div>
                  </div>
               )}
            </Card>
         </AuthPageLayout>
      </AuthShell>
   );
};

export default ConfirmAccount;
