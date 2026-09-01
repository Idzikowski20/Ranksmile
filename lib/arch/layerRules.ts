/**
 * Clean-architecture dependency rule, enforced by
 * __tests__/architecture/clean-arch-boundaries.test.ts.
 *
 * Each rule scans files under `root` and forbids any import specifier matching
 * one of `forbid`. Patterns match the raw specifier string, so they are written
 * to catch BOTH alias imports (`@/lib/x`, `@/src/infrastructure/y`) and relative
 * imports (`../../lib/x`, `../../infrastructure/y`) — hence segment-boundary
 * anchors like `(?:^|[\\/])lib[\\/]` rather than a literal `src/lib`.
 */
export type LayerRule = {
  root: string;
  label: string;
  /** Explicit deny-list — kept for clear violation messages on the common vendor/outer imports. */
  forbid: RegExp[];
  /**
   * Allow-list for NON-relative specifiers: any bare package, alias, or other-layer import
   * that matches none of these is a violation. Relative imports (./ , ../) are always allowed
   * — they stay inside the layer. This closes the deny-list's gap where an unlisted package
   * or another core layer would pass every `forbid` pattern.
   */
  allowOnly: RegExp[];
};

// Non-relative imports a pure core layer may make: only its own layer's siblings and the
// shared kernel. Node's own builtins are allowed (pure, no outer dependency).
const CORE_ALLOW = [
  /^node:/,
  /^@\/src\/core\/domain(?:[\\/]|$)/,
  /^@\/src\/core\/shared(?:[\\/]|$)/,
];

// Vendors / outer layers the pure core must never touch.
const VENDORS = [
  /stripe/i,
  /sequelize/i,
  /^next(?:-|\/|$)/,
  /ioredis|bullmq|(?:^|[\\/])redis(?:$|[\\/])/i,
  /(?:^|[\\/])axios(?:$|[\\/])|node-fetch/i,
];
const OUTER = [
  /(?:^|[\\/])infrastructure[\\/]/,
  /(?:^|[\\/])composition[\\/]/,
  /(?:^|[\\/])pages[\\/]/,
];
// Forbid ALL lib/* from core. The type carve-out (lib/types) has been relocated to
// src/core/shared/types, so core no longer needs any lib import.
const LIB = [/(?:^|[\\/])lib[\\/]/];

export const LAYER_RULES: LayerRule[] = [
  {
    root: 'src/core/domain',
    label: 'domain',
    // domain may import only src/core/domain + src/core/shared (+ relative, + node builtins)
    forbid: [...VENDORS, ...OUTER, ...LIB],
    allowOnly: CORE_ALLOW,
  },
  {
    root: 'src/core/application',
    label: 'application',
    // application may import only src/core/domain + src/core/shared (+ relative, + node builtins)
    forbid: [...VENDORS, ...OUTER, ...LIB],
    allowOnly: CORE_ALLOW,
  },
];
