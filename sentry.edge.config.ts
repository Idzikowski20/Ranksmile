import * as Sentry from '@sentry/nextjs';
import { isSentryEnabled, sentryEnvironment, sentryRelease } from './lib/sentryEnv';

const isProd = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: 'https://18c222ff04f3d3692f53c2167b6208a7@o4511496711241728.ingest.de.sentry.io/4511687227932752',
  enabled: isSentryEnabled(),
  environment: sentryEnvironment(),
  release: sentryRelease(),
  tracesSampleRate: isProd ? 0.1 : 1,
  enableLogs: true,
});
