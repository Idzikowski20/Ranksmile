/** @type {import('next').NextConfig} */

// Polyfill Web Crypto API for Node.js 18 (not a global by default)
if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line global-require
  const { webcrypto } = require('crypto');
  globalThis.crypto = webcrypto;
}

const { version } = require('./package.json');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  output: 'standalone',
  // Lint is a separate step (`npm run lint`); don't fail the production build on
  // style-only ESLint rules. The codebase's inline-style density (per DESIGN.md)
  // intentionally trips max-len/quotes/etc., and `next build` type-checks via tsc anyway.
  eslint: { ignoreDuringBuilds: true },
  // Fonts are loaded via a <link> in _document.tsx and resolved at runtime. Disable
  // Next's build-time font inlining so the build doesn't fetch Google Fonts (which
  // hangs/times-out the page-data collection in restricted-network build environments).
  optimizeFonts: false,
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
      { source: '/workspace/:wsId', destination: '/workspace/:wsId/dashboard', permanent: false },
      // The WordPress plugin opens the editor at /drafts/<id> (draft id == article id).
      { source: '/drafts/:id', destination: '/articles/:id', permanent: false },
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
