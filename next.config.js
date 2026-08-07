/** @type {import('next').NextConfig} */

// Polyfill Web Crypto API for Node.js 18 (not a global by default)
if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line global-require
  const { webcrypto } = require('crypto');
  globalThis.crypto = webcrypto;
}

const path = require('path');
const { version } = require('./package.json');
const { buildSiteSegmentRedirects } = require('./lib/navigation/routeAliases.cjs');

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// Zod 4 ships separate ESM + CJS builds. Next 12 webpack can pull both into the
// client bundle; mixing ZodString/$ZodType across copies crashes with
// "Cannot set properties of undefined (setting 'def')".
//
// IMPORTANT: use `$` exact-match aliases. A plain `zod → index.cjs` alias makes
// webpack rewrite `zod/v4/core` to `index.cjs/v4/core` (missing).
const zodRoot = path.dirname(require.resolve('zod/package.json'));
const zodAliases = {
  zod$: path.join(zodRoot, 'index.cjs'),
  'zod/v4$': path.join(zodRoot, 'v4', 'index.cjs'),
  'zod/v4/core$': path.join(zodRoot, 'v4', 'core', 'index.cjs'),
  'zod/v3$': path.join(zodRoot, 'v3', 'index.cjs'),
};

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  // Lint is a separate step (`npm run lint`); don't fail the production build on
  // style-only ESLint rules. The codebase's inline-style density (per DESIGN.md)
  // intentionally trips max-len/quotes/etc., and `next build` type-checks via tsc anyway.
  eslint: { ignoreDuringBuilds: true },
  // Fonts are loaded via a <link> in _document.tsx and resolved at runtime. Disable
  // Next's build-time font inlining so the build doesn't fetch Google Fonts (which
  // hangs/times-out the page-data collection in restricted-network build environments).
  optimizeFonts: false,
  images: {
    domains: [
      'lh3.googleusercontent.com',
      'cdn.jsdelivr.net',
      'avatars.githubusercontent.com',
    ],
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...zodAliases,
      '@': path.resolve(__dirname),
    };
    return config;
  },
  async rewrites() {
    return [
      { source: '/content-editor', destination: '/articles' },
      { source: '/content-editor/:path*', destination: '/articles/:path*' },
      { source: '/workspace/:wsId/sites/articles/new', destination: '/articles/new' },
      { source: '/workspace/:wsId/sites/articles/import', destination: '/articles/import' },
      { source: '/workspace/:wsId/:path*', destination: '/:path*' },
    ];
  },
  async redirects() {
    return [
      { source: '/domain/:slug*', destination: '/sites/:slug*', permanent: true },
      // Legacy auth entry points. Server-side so they land before any JS runs
      // (they used to be pages that redirected from useEffect).
      { source: '/login', destination: '/auth/sign-in', permanent: false },
      { source: '/register', destination: '/auth/sign-up', permanent: false },
      { source: '/workspace/:wsId', destination: '/workspace/:wsId/dashboard', permanent: false },
      // The WordPress plugin opens the editor at /drafts/<id> (draft id == article id).
      { source: '/drafts/:id', destination: '/articles/:id', permanent: false },
      // IA migration — legacy site segments → canonical (see lib/navigation/routeAliases).
      ...buildSiteSegmentRedirects(),
    ];
  },
  serverRuntimeConfig: {
    appURL: process.env.NEXT_PUBLIC_APP_URL || '',
  },
  publicRuntimeConfig: {
   version,
 },
};

module.exports = nextConfig;

// Sentry: on in production by default; set SENTRY_ENABLED=false to disable.
// Non-prod requires SENTRY_ENABLED=true.
const SENTRY_ENABLED = process.env.SENTRY_ENABLED === 'true'
  || (process.env.NODE_ENV === 'production' && process.env.SENTRY_ENABLED !== 'false');

if (SENTRY_ENABLED) {
  // Injected content via Sentry wizard below
  const { withSentryConfig } = require('@sentry/nextjs');

  const sentryWrapped = withSentryConfig(module.exports, {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options

    org: 'selmi',
    project: 'ranksmile',

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: '/monitoring',

    webpack: {
      // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
      // See the following for more information:
      // https://docs.sentry.io/product/crons/
      // https://vercel.com/docs/cron-jobs
      automaticVercelMonitors: true,

      // Tree-shaking options for reducing bundle size
      treeshake: {
        // Automatically tree-shake Sentry logger statements to reduce bundle size
        removeDebugLogging: true,
      },
    },
  });

  // @sentry/nextjs targets Next 13+ and injects `experimental.instrumentationHook` +
  // `experimental.serverComponentsExternalPackages`, which Next 12.3.4 doesn't recognise
  // (harmless "Invalid next.config.js options" warning on every boot). Strip them.
  if (sentryWrapped.experimental) {
    delete sentryWrapped.experimental.instrumentationHook;
    delete sentryWrapped.experimental.serverComponentsExternalPackages;
  }

  module.exports = withBundleAnalyzer(sentryWrapped);
} else {
  module.exports = withBundleAnalyzer(nextConfig);
}
