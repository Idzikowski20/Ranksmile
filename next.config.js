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
  async rewrites() {
    return [
      { source: '/content-editor', destination: '/articles' },
      { source: '/content-editor/:path*', destination: '/articles/:path*' },
    ];
  },
  async redirects() {
    return [
      { source: '/domain/:slug*', destination: '/sites/:slug*', permanent: true },
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
