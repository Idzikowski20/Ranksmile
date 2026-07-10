// Client Sentry bootstrap — loaded off the critical path (see scheduleSentryInit below).

type RouterTransitionHandler = typeof import('@sentry/nextjs').captureRouterTransitionStart;

let routerTransitionStart: RouterTransitionHandler | undefined;

function scheduleSentryInit() {
  if (typeof window === 'undefined') return;
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
