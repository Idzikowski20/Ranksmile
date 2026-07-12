import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://18c222ff04f3d3692f53c2167b6208a7@o4511496711241728.ingest.de.sentry.io/4511687227932752',
  integrations: [Sentry.replayIntegration()],
  tracesSampleRate: 1,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  dataCollection: {},
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
