import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';

const F = 'var(--font-family-primary)';

type ConfirmResult = { ok: boolean };
type Status = 'verifying' | 'error' | 'success';

const cardStyle: React.CSSProperties = {
   background: '#fff',
   border: '1px solid #F4F4F5',
   borderRadius: 12,
   padding: 32,
   maxWidth: 420,
   width: '100%',
   textAlign: 'center',
};

const ConfirmEmail: NextPage = () => {
   const router = useRouter();
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
               router.replace('/onboarding');
            } else {
               setStatus('error');
            }
         } catch {
            setStatus('error');
         }
      };

      verify();
   }, [router.isReady, router.query, router]);

   if (status === 'success') return null;

   return (
      <>
         <Head><title>Confirm your e-mail - SerpBear</title></Head>
         <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: F,
         }}
         >
            <div style={cardStyle}>
               {status === 'verifying' && (
                  <p style={{ margin: 0, fontSize: 15, color: '#52525C' }}>Confirming…</p>
               )}
               {status === 'error' && (
                  <>
                     <p style={{ margin: 0, fontSize: 15, color: '#18181B', lineHeight: 1.6 }}>
                        This confirmation link is invalid or has expired.
                     </p>
                     <button
                        type="button"
                        onClick={() => router.push('/auth/confirm-account')}
                        style={{
                           marginTop: 20,
                           background: '#2F2F34',
                           color: '#fff',
                           border: 'none',
                           borderRadius: 8,
                           padding: '10px 20px',
                           fontSize: 14,
                           fontWeight: 600,
                           fontFamily: F,
                           cursor: 'pointer',
                           transition: 'background 150ms ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#783AFB'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
                     >
                        Send a new link
                     </button>
                  </>
               )}
            </div>
         </div>
      </>
   );
};

export default ConfirmEmail;
