import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import toast from 'react-hot-toast';
import { authClient } from '../../lib/auth/client';

// ──────────────────────────────────────────────
// Shared button base classes (Ranksmile canonical)
// ──────────────────────────────────────────────
const btnBase =
   'gap-sm focus-visible:outline-purple-40 relative inline-flex cursor-pointer items-center justify-center border-none font-sans font-semibold transition-[color,background-color,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 [&:not(:focus-visible)]:outline-none';

const btnSecondary = `${btnBase} px-lg py-sm rounded-lg text-base bg-gray-10 text-gray-base hover:bg-gray-20 active:bg-gray-40 mb-md`;
const btnPrimary   = `${btnBase} px-lg py-sm rounded-lg text-base bg-gray-base text-white-base hover:bg-purple-base active:bg-purple-100 mt-base mb-4xl`;
const btnLink      = `${btnBase} text-base rounded-none bg-transparent p-0 text-gray-100 hover:text-gray-120 active:text-gray-160`;

// ──────────────────────────────────────────────
// Wordmark (no logo SVG in public/)
// ──────────────────────────────────────────────
const Wordmark = () => (
   <span className="h-lg flex items-center text-xl font-bold tracking-tight text-gray-base">
      Ranksmile
   </span>
);

// ──────────────────────────────────────────────
// Common page wrapper
// ──────────────────────────────────────────────
function PageShell({ children }: { children: React.ReactNode }) {
   return (
      <div className="p-sm relative flex flex-col overflow-hidden">
         <div className="relative flex-1 overflow-auto rounded-xl [color-scheme:light] px-base sm:px-lg bg-white-base">
            <div className="pt-5xl flex flex-col items-center">
               <Wordmark />
               {children}
            </div>
         </div>
      </div>
   );
}

// ──────────────────────────────────────────────
// Invitation data shape returned by the API
// ──────────────────────────────────────────────
interface InviteData {
   status: 'pending' | 'invalid' | string;
   email: string;
   role: string;
   orgName: string;
   workspaceCount: number;
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function InvitePage() {
   const router = useRouter();
   const token = router.query.token as string | undefined;

   const sessionResult = authClient.useSession?.() ?? { data: null, isPending: true };
   const session = sessionResult.data;
   const sessionPending = sessionResult.isPending;
   const sessionEmail: string = session?.user?.email ?? '';
   const isLoggedIn = !!session?.user;

   const [accepting, setAccepting] = useState(false);

   // ── Send to sign-in, remembering where to return afterwards ───────────
   const goToSignIn = () => {
      try { if (token) localStorage.setItem('post_login_redirect', `/invite/${token}`); } catch { /* ignore */ }
      window.location.href = '/auth/sign-in';
   };

   // ── Redirect to sign-in if not authenticated ──────────────────────────
   React.useEffect(() => {
      if (sessionPending) return;
      if (!isLoggedIn) goToSignIn();
   }, [sessionPending, isLoggedIn]);

   // More robust: only redirect once we're certain there's no user.
   // useSession returns { data: null } initially (loading) and then resolves.
   // We check via a mounted+session combo.
   const [mounted, setMounted] = React.useState(false);
   React.useEffect(() => { setMounted(true); }, []);

   // ── Fetch invitation data ──────────────────────────────────────────────
   const { data, isLoading } = useQuery<InviteData>(
      ['invite', token],
      () => fetch(`/api/invitations/${token}`).then((r) => r.json()),
      {
         enabled: !!token && isLoggedIn,
         retry: false,
      },
   );

   // ── Sign-out helper ────────────────────────────────────────────────────
   const handleSignOut = async () => {
      await authClient.signOut();
      goToSignIn();
   };

   // ── Accept invitation ──────────────────────────────────────────────────
   const handleAccept = async () => {
      if (!token) return;
      setAccepting(true);
      try {
         const res = await fetch(`/api/invitations/${token}/accept`, { method: 'POST' });
         if (res.ok) {
            toast.success('Invitation accepted — you have been added to the organization');
            router.push('/dashboard');
         } else if (res.status === 409) {
            toast.error('This invitation was sent to a different email address.');
         } else {
            toast.error('Could not accept the invitation.');
         }
      } catch {
         toast.error('Could not accept the invitation.');
      } finally {
         setAccepting(false);
      }
   };

   // ── Guard: not yet mounted or session still loading ───────────────────
   if (!mounted) return null;

   // ── Guard: no session → redirect (show nothing while redirecting) ──────
   if (!isLoggedIn) {
      // Trigger redirect imperatively in case effect hasn't fired yet
      if (typeof window !== 'undefined') {
         goToSignIn();
      }
      return (
         <PageShell>
            <p className="py-lg text-base text-gray-base">Redirecting…</p>
         </PageShell>
      );
   }

   // ── Guard: query loading ───────────────────────────────────────────────
   if (isLoading || !data) {
      return (
         <PageShell>
            <p className="py-lg text-base text-gray-base">Loading…</p>
         </PageShell>
      );
   }

   // ── State: invalid ─────────────────────────────────────────────────────
   if (data.status !== 'pending') {
      return (
         <PageShell>
            <p className="py-lg text-base">This invitation is no longer valid.</p>
            <button type="button" className={btnLink} onClick={() => router.push('/dashboard')}>
               ‹ Go Back to the App
            </button>
         </PageShell>
      );
   }

   const emailMatch = sessionEmail.toLowerCase() === data.email.toLowerCase();

   // ── State A: wrong email ───────────────────────────────────────────────
   if (!emailMatch) {
      return (
         <PageShell>
            <div className="py-lg text-base">
               This invitation was sent to a different email address. Sign out and sign in with the invited email to accept it.
            </div>
            <div className="text-gray-140 py-md">You are logged in as {sessionEmail}</div>
            <button type="button" className={btnSecondary} onClick={handleSignOut}>
               Sign out
            </button>
            <button type="button" className={btnLink} onClick={() => router.push('/dashboard')}>
               ‹ Go Back to the App
            </button>
         </PageShell>
      );
   }

   // ── State B: email matches ─────────────────────────────────────────────
   const { orgName, role, workspaceCount } = data;
   return (
      <PageShell>
         <div className="py-lg flex flex-col items-center">
            <div className="text-base">
               You&apos;ve been invited to join{' '}
               <span className="font-semibold">{orgName || 'a Ranksmile organization'}</span>
               {' '}as{' '}
               <span className="font-semibold">{role}</span>
               {' '}with access to{' '}
               <span className="font-semibold">
                  {workspaceCount} workspace{workspaceCount === 1 ? '' : 's'}
               </span>
            </div>
            <button
               type="button"
               className={btnPrimary}
               onClick={handleAccept}
               disabled={accepting}
            >
               Accept invitation
            </button>
         </div>
         <div className="text-gray-140 py-md">You are logged in as {sessionEmail}</div>
         <button type="button" className={btnSecondary} onClick={handleSignOut}>
            Sign out
         </button>
         <button type="button" className={btnLink} onClick={() => router.push('/dashboard')}>
            ‹ Go Back to the App
         </button>
      </PageShell>
   );
}
