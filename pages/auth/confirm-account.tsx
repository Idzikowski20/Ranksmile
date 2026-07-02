import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';
import { authClient } from '../../lib/auth/client';

const F = 'var(--font-family-primary)';

type ConfirmStatus = { confirmed: boolean; email?: string };
type SendResult = { sent?: boolean; confirmed?: boolean; cooldownMs?: number };

/** Simple flat-shape envelope illustration: white envelope + orange-bordered card peeking out with two eyes. */
const EnvelopeIllustration = () => (
   <svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* envelope body */}
      <rect x="20" y="60" width="160" height="90" rx="10" fill="#FFFFFF" />
      {/* envelope flap (open) */}
      <path d="M20 68 L100 20 L180 68 L180 60 L100 12 L20 60 Z" fill="#FFFFFF" />
      {/* envelope bottom fold lines */}
      <path d="M22 62 L100 118 L178 62" stroke="#D4D4D8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* card peeking out */}
      <rect x="58" y="26" width="84" height="60" rx="10" fill="#FFFFFF" stroke="#FF8A4C" strokeWidth="3" />
      {/* eyes on the card */}
      <rect x="80" y="50" width="10" height="16" rx="4" fill="#18181B" />
      <rect x="110" y="50" width="10" height="16" rx="4" fill="#18181B" />
   </svg>
);

const ConfirmAccount: NextPage = () => {
   const router = useRouter();
   const [email, setEmail] = useState<string>('');
   const [showRightPanel, setShowRightPanel] = useState<boolean>(false);
   const [cooldown, setCooldown] = useState<number>(0);
   const [sent, setSent] = useState<boolean>(false);
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
      const mq = window.matchMedia('(min-width: 1280px)');
      setShowRightPanel(mq.matches);
      const onChange = (e: MediaQueryListEvent) => setShowRightPanel(e.matches);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
   }, []);

   useEffect(() => {
      if (!initialized.current) {
         initialized.current = true;

         const init = async () => {
            try {
               const statusRes = await fetch('/api/confirm-account');
               const status: ConfirmStatus = await statusRes.json();
               if (status.confirmed) {
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
                  router.replace('/onboarding');
               }
            } catch {
               // network error on initial load — user can still use "Resend email" manually.
            }
         };

         init();
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
      await authClient.signOut();
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
      <>
         <Head><title>Confirm your e-mail - SerpBear</title></Head>
         <div style={{ minHeight: '100vh', padding: 12, background: '#f8f9ff', fontFamily: F }}>
            <div style={{ display: 'flex', gap: 12, minHeight: 'calc(100vh - 24px)' }}>
               {/* LEFT white panel */}
               <div style={{
                  flex: 1,
                  background: '#fff',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  textAlign: 'center',
               }}
               >
                  <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#18181B' }}>
                     Check your e-mail
                  </h1>
                  <p style={{ margin: '12px 0 24px', fontSize: 15, color: '#18181B', lineHeight: 1.6, maxWidth: 420 }}>
                     We sent a temporary link to the email address, <strong style={{ fontWeight: 700 }}>{email}</strong>.
                     <br />
                     Please check your Spam folder as well.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendDisabled}
                        style={{
                           background: '#2F2F34',
                           color: '#fff',
                           border: 'none',
                           borderRadius: 8,
                           padding: '10px 20px',
                           fontSize: 14,
                           fontWeight: 600,
                           fontFamily: F,
                           cursor: resendDisabled ? 'not-allowed' : 'pointer',
                           opacity: resendDisabled ? 0.6 : 1,
                           transition: 'background 150ms ease',
                        }}
                        onMouseEnter={(e) => { if (!resendDisabled) e.currentTarget.style.background = '#783AFB'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
                     >
                        {resendLabel}
                     </button>
                     <button
                        type="button"
                        onClick={handleSignOut}
                        style={{
                           background: 'transparent',
                           border: 'none',
                           padding: 0,
                           color: '#52525C',
                           fontSize: 14,
                           fontWeight: 600,
                           fontFamily: F,
                           cursor: 'pointer',
                           transition: 'color 150ms ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#18181B'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#52525C'; }}
                     >
                        Sign out
                     </button>
                  </div>
               </div>

               {/* RIGHT purple panel */}
               {showRightPanel && (
                  <div style={{
                     flex: '0 0 40%',
                     background: '#783AFB',
                     borderRadius: 12,
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: 'center',
                     justifyContent: 'center',
                     padding: 24,
                     textAlign: 'center',
                  }}
                  >
                     <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: '#fff', letterSpacing: '-2px', lineHeight: 1.2 }}>
                        We just sent
                        <br />
                        you an email!
                     </h2>
                     <div style={{ marginTop: 32 }}>
                        <EnvelopeIllustration />
                     </div>
                  </div>
               )}
            </div>
         </div>
      </>
   );
};

export default ConfirmAccount;
