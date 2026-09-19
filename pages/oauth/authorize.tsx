/**
 * /oauth/authorize — the consent screen an MCP host opens before it may read anything.
 *
 * Public in the shell's sense (no bootstrap gate) so the flow survives a signed-out user:
 * the page asks the API who the caller is, and offers a sign-in that returns here.
 */
import React from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AuthPageLayout from '../../components/auth/AuthPageLayout';
import { Button } from '../../components/koala/core';
import { Icon } from '../../components/koala/icons/Icon';
import { BounceSmileyAnimation } from '../../components/common/BounceSmileyAnimation';

type Phase = 'loading' | 'needs_signin' | 'ready' | 'error';

const SCOPE_ITEMS = [
   'Your workspaces and their domains',
   'Articles, their content and scores (SEO / AI)',
   'Auto-Optimize history and generation jobs',
];

const ERROR_TEXT: Record<string, string> = {
   unknown_client: 'This application is not registered with Ranksmile.',
   invalid_target: 'The application asked for a resource this server does not serve.',
   cross_origin_request: 'The request came from outside Ranksmile and was rejected.',
   redirect_uri_mismatch: 'The return address does not match what this application registered. Connection refused.',
   missing_params: 'The authorization request is missing required parameters.',
   bad_request: 'Invalid authorization request.',
   server_error: 'Something went wrong on our side. Please try again.',
};

const q = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? '' : v ?? '');

const labelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--koala-text-tertiary)', margin: 0 };

const AuthorizePage: NextPage = () => {
   const router = useRouter();
   const [phase, setPhase] = React.useState<Phase>('loading');
   const [clientName, setClientName] = React.useState('');
   const [errorCode, setErrorCode] = React.useState('bad_request');
   const [busy, setBusy] = React.useState(false);

   const params = React.useMemo(() => ({
      clientId: q(router.query.client_id),
      redirectUri: q(router.query.redirect_uri),
      codeChallenge: q(router.query.code_challenge),
      codeChallengeMethod: q(router.query.code_challenge_method),
      state: q(router.query.state),
      scope: q(router.query.scope),
      resource: q(router.query.resource),
   }), [router.query]);

   React.useEffect(() => {
      if (!router.isReady) return;
      if (!params.clientId || !params.redirectUri || !params.codeChallenge) {
         setErrorCode('missing_params');
         setPhase('error');
         return;
      }
      let cancelled = false;
      (async () => {
         try {
            const res = await fetch(
               `/api/mcp/oauth/consent?client_id=${encodeURIComponent(params.clientId)}&redirect_uri=${encodeURIComponent(params.redirectUri)}`,
               { credentials: 'same-origin' },
            );
            if (cancelled) return;
            if (res.status === 401) { setPhase('needs_signin'); return; }
            const body = (await res.json()) as { client_name?: string | null; error?: string };
            if (!res.ok) {
               setErrorCode(body.error || 'bad_request');
               setPhase('error');
               return;
            }
            setClientName(body.client_name || 'Agent');
            setPhase('ready');
         } catch {
            if (!cancelled) { setErrorCode('server_error'); setPhase('error'); }
         }
      })();
      return () => { cancelled = true; };
   }, [router.isReady, params]);

   const approve = async () => {
      setBusy(true);
      try {
         const res = await fetch('/api/mcp/oauth/consent', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               client_id: params.clientId,
               redirect_uri: params.redirectUri,
               code_challenge: params.codeChallenge,
               code_challenge_method: params.codeChallengeMethod || 'S256',
               state: params.state,
               scope: params.scope,
               resource: params.resource,
            }),
         });
         const body = (await res.json()) as { redirect?: string; error?: string };
         if (!res.ok || !body.redirect) {
            setErrorCode(body.error || 'server_error');
            setPhase('error');
            setBusy(false);
            return;
         }
         window.location.href = body.redirect;
      } catch {
         setErrorCode('server_error');
         setPhase('error');
         setBusy(false);
      }
   };

   /** Denial is still an OAuth answer: the host is told, rather than left hanging. */
   const deny = () => {
      try {
         const url = new URL(params.redirectUri);
         url.searchParams.set('error', 'access_denied');
         if (params.state) url.searchParams.set('state', params.state);
         window.location.href = url.toString();
      } catch {
         router.replace('/');
      }
   };

   const signInHref = `/auth/sign-in?callbackUrl=${encodeURIComponent(router.asPath)}`;

   return (
      <>
         <Head>
            <title>Connect an agent — Ranksmile</title>
            <meta name="robots" content="noindex" />
         </Head>
         <AuthPageLayout>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'inline-flex', padding: 8, borderRadius: 9999, border: '1px solid var(--koala-border-primary)' }}>
                     <BounceSmileyAnimation compact size={24} entrance={false} animateRotate={false} />
                  </div>
                  <Icon name="ArrowsLeftRight" size={18} weight="bold" />
                  <div style={{ display: 'inline-flex', padding: 8, borderRadius: 9999, border: '1px solid var(--koala-border-primary)' }}>
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img src="/images/mcp-logo.webp" alt="" aria-hidden="true" width={24} height={24} style={{ display: 'block' }} />
                  </div>
               </div>

               {phase === 'loading' ? <p style={labelStyle}>Checking the connection…</p> : null}

               {phase === 'error' ? (
                  <>
                     <h1 style={{ margin: 0, fontSize: 22, textAlign: 'center', color: 'var(--koala-text-primary)' }}>
                        Cannot connect
                     </h1>
                     <p style={{ ...labelStyle, textAlign: 'center' }}>{ERROR_TEXT[errorCode] || ERROR_TEXT.bad_request}</p>
                     <Button variant="secondary" onClick={() => router.replace('/')}>Back to Ranksmile</Button>
                  </>
               ) : null}

               {phase === 'needs_signin' ? (
                  <>
                     <h1 style={{ margin: 0, fontSize: 22, textAlign: 'center', color: 'var(--koala-text-primary)' }}>
                        Sign in to connect this agent
                     </h1>
                     <p style={{ ...labelStyle, textAlign: 'center' }}>
                        You will come back here afterwards to finish connecting.
                     </p>
                     <Button variant="primary" onClick={() => { window.location.href = signInHref; }}>
                        Sign in
                     </Button>
                  </>
               ) : null}

               {phase === 'ready' ? (
                  <>
                     <h1 style={{ margin: 0, fontSize: 22, textAlign: 'center', color: 'var(--koala-text-primary)' }}>
                        <strong>{clientName}</strong> wants access to Ranksmile
                     </h1>
                     <div
                        style={{
                           width: '100%',
                           border: '1px solid var(--koala-border-primary)',
                           borderRadius: 16,
                           padding: 20,
                           display: 'flex',
                           flexDirection: 'column',
                           gap: 12,
                           textAlign: 'left',
                        }}
                     >
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--koala-text-primary)' }}>
                           This agent will be able to read:
                        </div>
                        {SCOPE_ITEMS.map((item) => (
                           <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, color: 'var(--koala-text-secondary)' }}>
                              <Icon name="Check" size={16} weight="bold" />
                              <span>{item}</span>
                           </div>
                        ))}
                        <div style={{ ...labelStyle, marginTop: 4 }}>
                           Read-only access — the agent cannot edit, publish or delete anything.
                           You can revoke it any time under Settings → MCP &amp; API.
                        </div>
                        {/* The redirect target is where the authorization code is delivered.
                            Showing it is the user's only defence against a client that
                            registered someone else's name — a localhost URI especially. */}
                        <div style={{ ...labelStyle, wordBreak: 'break-all' }}>
                           The authorization code will be sent to: <strong style={{ color: 'var(--koala-text-secondary)' }}>{params.redirectUri}</strong>
                        </div>
                     </div>

                     <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                        <Button variant="secondary" onClick={deny} disabled={busy} style={{ flex: 1 }}>
                           Deny
                        </Button>
                        <Button variant="primary" onClick={approve} disabled={busy} style={{ flex: 1 }}>
                           {busy ? 'Connecting…' : 'Allow'}
                        </Button>
                     </div>
                  </>
               ) : null}
            </div>
         </AuthPageLayout>
      </>
   );
};

export default AuthorizePage;
