/**
 * Clean-architecture dependency rule, enforced by
 * __tests__/architecture/clean-arch-boundaries.test.ts.
 *
 * Each rule scans files under `root`. An import is a violation when:
 *  - it is a bare (npm / `node:`) specifier matching `forbidBare`, or
 *  - it is an internal import (`@/…` or a relative path) that resolves OUTSIDE
 *    every `allowInternal` prefix.
 *
 * `allowInternal` is an allowlist of repo-relative path prefixes (resolved from
 * the specifier), so a NEW cross-layer import is a violation by default — the old
 * denylist silently passed anything it forgot to list (`@/pages`, `@/src/core/
 * application/*`, `@/src/core/primitives/*`, `node:fs`, …).
 */
export type LayerRule = {
  root: string;
  label: string;
  /** Bare (npm / `node:`) specifiers this layer must never import. */
  forbidBare: RegExp[];
  /** Repo-relative path prefixes that internal imports may resolve to. */
  allowInternal: RegExp[];
};

// Vendors + node builtins the pure core must never touch.
const FORBID_BARE = [
  /^node:/,
  /stripe/i,
  /sequelize/i,
  /^next(?:-|\/|$)/,
  /ioredis|bullmq|(?:^|[\\/])redis(?:$|[\\/])/i,
  /(?:^|[\\/])axios(?:$|[\\/])|node-fetch/i,
];

const DOMAIN = /^src\/core\/domain(?:\/|$)/;
const SHARED = /^src\/core\/shared(?:\/|$)/;
const APPLICATION = /^src\/core\/application(?:\/|$)/;

export const LAYER_RULES: LayerRule[] = [
  {
    root: 'src/core/domain',
    label: 'domain',
    // domain may import only src/core/domain + src/core/shared
    forbidBare: FORBID_BARE,
    allowInternal: [DOMAIN, SHARED],
  },
  {
    root: 'src/core/application',
    label: 'application',
    // application may import src/core/application + domain + shared
    forbidBare: FORBID_BARE,
    allowInternal: [APPLICATION, DOMAIN, SHARED],
  },
];
