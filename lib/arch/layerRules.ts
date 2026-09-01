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
import { builtinModules } from 'node:module';

export type LayerRule = {
  root: string;
  label: string;
  /** Explicit deny-list — kept for clear violation messages on the common vendor/outer imports. */
  forbid: RegExp[];
  /**
   * Allow-list for NON-relative specifiers (bare packages, aliases): anything matching none of
   * these is a violation. Closes the deny-list's gap where an unlisted package or another core
   * layer would pass every `forbid` pattern.
   */
  allowOnly: RegExp[];
  /**
   * Repo-relative path roots a RELATIVE import may resolve into. A relative specifier is
   * resolved against the importing file and rejected if it lands outside these — otherwise
   * `../../application/x` from a domain file would escape the layer unchecked.
   */
  allowedRoots: string[];
};

// Node's own builtins, both `node:fs` and bare `fs`/`path`/`crypto` — pure, no outer dependency.
const NODE_BUILTIN = new RegExp(
  `^(?:node:)?(?:${builtinModules.map((m) => m.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|')})(?:[\\/]|$)`,
);

// Non-relative imports a pure core layer may make: only its own layer's siblings and the
// shared kernel (as aliases), plus node builtins.
const CORE_ALLOW = [
  NODE_BUILTIN,
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
    // domain may import only src/core/domain + src/core/shared (+ node builtins)
    forbid: [...VENDORS, ...OUTER, ...LIB],
    allowOnly: CORE_ALLOW,
    allowedRoots: ['src/core/domain', 'src/core/shared'],
  },
  {
    root: 'src/core/application',
    label: 'application',
    // application may import src/core/application + src/core/domain + src/core/shared (+ node builtins)
    forbid: [...VENDORS, ...OUTER, ...LIB],
    allowOnly: CORE_ALLOW,
    allowedRoots: ['src/core/application', 'src/core/domain', 'src/core/shared'],
  },
];
