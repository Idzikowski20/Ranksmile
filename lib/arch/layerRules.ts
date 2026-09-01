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
  forbid: RegExp[];
  /** Repo-relative paths under `root` to skip (matched against the forward-slash path). */
  exclude?: RegExp;
};

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
// Inner-layer specifiers, so the denylist enforces dependency DIRECTION, not just
// keeps outer layers out: a domain file importing `../../application/x` (an inverted
// dependency) is caught the same as a vendor import. A layer never lists its own
// segment — that would forbid its files from importing each other.
const APPLICATION = [/(?:^|[\\/])application[\\/]/];
const DOMAIN = [/(?:^|[\\/])domain[\\/]/];

export const LAYER_RULES: LayerRule[] = [
  {
    root: 'src/core/domain',
    label: 'domain',
    // domain may import only src/core/domain + src/core/shared
    forbid: [...VENDORS, ...OUTER, ...LIB, ...APPLICATION],
  },
  {
    root: 'src/core/application',
    label: 'application',
    // application may import src/core/application + domain + shared
    forbid: [...VENDORS, ...OUTER, ...LIB],
  },
  {
    root: 'src/core/shared',
    label: 'shared',
    // shared runtime primitives are the innermost leaf — may import only src/core/shared.
    // The relocated type barrel (src/core/shared/types/*) is a pure type-declaration
    // surface that legitimately references types from every layer (the old lib/types
    // carve-out), so it is excluded from the leaf constraint.
    forbid: [...VENDORS, ...OUTER, ...LIB, ...APPLICATION, ...DOMAIN],
    // ponytail: blanket carve-out — the whole types/ subtree skips the leaf check, so a
    // stray vendor/outer *runtime* import in a types file would go unnoticed. Acceptable
    // while types/ is declaration-only (`import type` erases at build). Upgrade path when
    // it gains runtime code: scan types/ too but allow only `import type` specifiers.
    exclude: /^src[\\/]core[\\/]shared[\\/]types[\\/]/,
  },
];
