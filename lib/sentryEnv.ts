/** Shared release / environment labels for Sentry. */
export function sentryEnvironment(): string {
  if (process.env.SENTRY_ENVIRONMENT) return process.env.SENTRY_ENVIRONMENT;
  if (process.env.RAILWAY_ENVIRONMENT) return process.env.RAILWAY_ENVIRONMENT;
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV;
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

export function sentryRelease(): string {
  return (
    process.env.SENTRY_RELEASE
    || process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.RAILWAY_GIT_COMMIT_SHA
    || process.env.GITHUB_SHA
    || process.env.npm_package_version
    || 'unknown'
  );
}

/** Prod on by default unless explicitly disabled; non-prod requires opt-in. */
export function isSentryEnabled(): boolean {
  if (process.env.SENTRY_ENABLED === 'false' || process.env.SENTRY_ENABLED === '0') return false;
  if (process.env.SENTRY_ENABLED === 'true' || process.env.SENTRY_ENABLED === '1') return true;
  return process.env.NODE_ENV === 'production';
}

export function isSentryClientEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'false' || process.env.NEXT_PUBLIC_SENTRY_ENABLED === '0') {
    return false;
  }
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true' || process.env.NEXT_PUBLIC_SENTRY_ENABLED === '1') {
    return true;
  }
  return process.env.NODE_ENV === 'production';
}
