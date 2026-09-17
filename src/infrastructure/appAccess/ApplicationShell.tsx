/**
 * ApplicationShell — single access gate consuming Access Snapshot from bootstrap.
 * Replaces independent Onboarding / Billing / PaymentFailed / Workspace if-guards.
 */
import React from 'react';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { fetchBootstrapOrNull } from '@/src/infrastructure/http/fetchBootstrap';
import type { BootstrapData } from '@/src/infrastructure/http/getBootstrap';
import { foreignWorkspaceFallback } from '@/src/core/domain/navigation/activeWorkspace';
import { isPublicRoute } from '@/src/infrastructure/config/isPublicPath';
import { PlanExpired } from '@/components/billing/PlanExpired';
import { showsPlanExpired } from '@/src/infrastructure/appAccess/isPlanExpired';
import {
  allowsFrontend,
  emitAccessTimeline,
  redirectLoopKey,
  type AccessSnapshot,
  type AppState,
} from '@/src/infrastructure/appAccess/index';
import { OnboardingStatusContext } from '@/src/infrastructure/onboardingStatus';
import { EmailConfirmedStatusContext } from '@/src/infrastructure/emailConfirmedStatus';
import { logOnboardingRedirect } from '@/src/infrastructure/billing/billingAuditShared';
import AppLoading from '@/components/common/AppLoading';

const BOOTSTRAP_STALE_MS = 5 * 60_000;

type Props = { children: React.ReactNode };

export function ApplicationShell({ children }: Props) {
  const router = useRouter();
  const asPath = router.asPath;
  const path = asPath.split('?')[0] || router.pathname;
  const isPublic = isPublicRoute(asPath, router.pathname);

  const [completedOverride, setCompleted] = React.useState<boolean | null>(null);
  const [confirmedOverride, setConfirmed] = React.useState<boolean | null>(null);
  const everHadUser = React.useRef(false);
  const everHadBootstrap = React.useRef(false);
  const lastRedirectKey = React.useRef<string | null>(null);
  const prevAppState = React.useRef<AppState | null>(null);

  const {
    data: bootstrap,
    isLoading: bootstrapLoading,
    isFetched,
    isError,
    isFetching,
    refetch,
  } = useQuery(
    ['bootstrap'],
    fetchBootstrapOrNull,
    {
      enabled: !isPublic,
      staleTime: BOOTSTRAP_STALE_MS,
      retry: 3,
      retryDelay: (n) => Math.min(1000 * (n + 1), 3000),
    },
  );

  const hasSession = bootstrap != null;
  const signedOut = isFetched && !isError && bootstrap === null;
  const isPending = !isPublic && (bootstrapLoading || (isFetching && bootstrap === undefined));

  if (hasSession) everHadUser.current = true;
  if (bootstrap) everHadBootstrap.current = true;

  const access: AccessSnapshot | null = bootstrap?.access ?? null;

  // Local overrides after confirm / onboarding finish → optimistic patch until refetch.
  const effectiveAccess = React.useMemo((): AccessSnapshot | null => {
    if (!access) return null;
    if (completedOverride === true && access.appState === 'ONBOARDING_REQUIRED') {
      return {
        ...access,
        appState: 'BILLING_REQUIRED',
        reason: 'NO_ACTIVE_ENTITLEMENT',
        redirect: {
          redirect: '/plans',
          replace: true,
          reason: 'NO_ACTIVE_ENTITLEMENT',
        },
      };
    }
    if (confirmedOverride === true && access.appState === 'EMAIL_PENDING') {
      const onboardingDone = bootstrap?.onboarding?.completed === true || completedOverride === true;
      if (!onboardingDone) {
        return {
          ...access,
          appState: 'ONBOARDING_REQUIRED',
          reason: 'ONBOARDING_INCOMPLETE',
          redirect: {
            redirect: '/onboarding',
            replace: true,
            reason: 'ONBOARDING_INCOMPLETE',
          },
        };
      }
      return {
        ...access,
        appState: 'BILLING_REQUIRED',
        reason: 'NO_ACTIVE_ENTITLEMENT',
        redirect: {
          redirect: '/plans',
          replace: true,
          reason: 'NO_ACTIVE_ENTITLEMENT',
        },
      };
    }
    return access;
  }, [access, completedOverride, confirmedOverride, bootstrap?.onboarding?.completed]);

  React.useEffect(() => {
    if (completedOverride === true || confirmedOverride === true) {
      void refetch();
    }
  }, [completedOverride, confirmedOverride, refetch]);

  React.useEffect(() => {
    if (isPublic || isPending) return;
    if (signedOut) router.replace('/auth/sign-in');
  }, [isPublic, isPending, signedOut, router]);

  React.useEffect(() => {
    if (isPublic || !isError || hasSession) return undefined;
    const t = window.setTimeout(() => { void refetch(); }, 1500);
    return () => window.clearTimeout(t);
  }, [isPublic, isError, hasSession, refetch]);

  const foreignTarget = bootstrap && !isPublic ? workspaceFallbackFor(asPath, bootstrap) : null;

  // A workspace URL the user can't access. Confirm against a fresh bootstrap first (a
  // just-created workspace may be missing from the cached one), then do a full load into an
  // accessible workspace — that also drops the 403 responses already cached for the old id.
  React.useEffect(() => {
    if (!foreignTarget) return undefined;
    let cancelled = false;
    void refetch().then(({ data }) => {
      if (cancelled || !data) return;
      const target = workspaceFallbackFor(asPath, data);
      if (target) window.location.replace(target);
    });
    return () => { cancelled = true; };
  }, [foreignTarget, asPath, refetch]);

  // STATE_CHANGED timeline
  React.useEffect(() => {
    if (!effectiveAccess) return;
    const next = effectiveAccess.appState;
    const prev = prevAppState.current;
    if (prev !== next) {
      emitAccessTimeline({
        type: 'STATE_CHANGED',
        prev,
        next,
        reason: effectiveAccess.reason,
        at: new Date().toISOString(),
      });
      prevAppState.current = next;
    }
  }, [effectiveAccess]);

  // Single policy gate
  React.useEffect(() => {
    if (!hasSession || !effectiveAccess || isPublic) return;
    // The expired block renders in place; redirecting would fight that render. Same
    // predicate as the render below, so the two can never disagree about a route.
    if (showsPlanExpired(effectiveAccess, path)) return;
    if (allowsFrontend(effectiveAccess.appState, path)) return;

    const to = effectiveAccess.redirect.redirect;
    const key = redirectLoopKey(
      effectiveAccess.appState,
      effectiveAccess.reason,
      asPath.split('?')[0] ?? path,
      to,
    );
    if (lastRedirectKey.current === key) {
      emitAccessTimeline({
        type: 'REDIRECT_LOOP_BLOCKED',
        key,
        at: new Date().toISOString(),
      });
      return;
    }
    lastRedirectKey.current = key;
    emitAccessTimeline({
      type: 'REDIRECT',
      from: asPath,
      to,
      appState: effectiveAccess.appState,
      reason: effectiveAccess.reason,
      at: new Date().toISOString(),
    });
    logOnboardingRedirect({
      from: asPath,
      to,
      reason: effectiveAccess.reason,
      workspaces: bootstrap?.workspaces?.length ?? 0,
      pathname: path,
    });
    if (effectiveAccess.redirect.replace) {
      void router.replace(to);
    } else {
      void router.push(to);
    }
  }, [
    hasSession,
    effectiveAccess,
    isPublic,
    path,
    asPath,
    router,
    bootstrap?.workspaces?.length,
  ]);

  if (!isPublic && !everHadUser.current && (isPending || isError)) {
    return <AppLoading />;
  }
  if (!isPublic && signedOut && !everHadUser.current) {
    return <AppLoading />;
  }
  if (hasSession && bootstrapLoading && !bootstrap && !everHadBootstrap.current) {
    return <AppLoading />;
  }
  if (foreignTarget) {
    return <AppLoading />;
  }
  if (hasSession && !isPublic && effectiveAccess && showsPlanExpired(effectiveAccess, path)) {
    return <PlanExpired />;
  }
  if (hasSession && !isPublic && effectiveAccess && !allowsFrontend(effectiveAccess.appState, path)) {
    return <AppLoading />;
  }

  return (
    <EmailConfirmedStatusContext.Provider value={setConfirmed}>
      <OnboardingStatusContext.Provider value={setCompleted}>
        {children}
      </OnboardingStatusContext.Provider>
    </EmailConfirmedStatusContext.Provider>
  );
}

function workspaceFallbackFor(asPath: string, bootstrap: BootstrapData): string | null {
  return foreignWorkspaceFallback(asPath, {
    workspaceIds: (bootstrap.workspaces ?? []).map((w) => w.id),
    setupWorkspaceId: bootstrap.setupWorkspaceId ?? null,
    activeId: bootstrap.activeId ?? null,
  });
}

export default ApplicationShell;
