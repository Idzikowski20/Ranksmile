// Client Sentry bootstrap — disabled for now (set SENTRY_ENABLED=true to re-enable).

type RouterTransitionHandler = typeof import('@sentry/nextjs').captureRouterTransitionStart;

let routerTransitionStart: RouterTransitionHandler | undefined;

function scheduleSentryInit() {
  if (typeof window === 'undefined') return;
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED !== 'true') return;
  const run = () => {
    void import('./sentry-client-init').then((mod) => {
      routerTransitionStart = mod.onRouterTransitionStart;
    });
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 2000);
  }
}

scheduleSentryInit();

export const onRouterTransitionStart: RouterTransitionHandler = (...args) => {
  routerTransitionStart?.(...args);
};
