# components/core — migration shim

Design tokens and new primitives live in [`components/koala`](../koala/).

- `theme.tsx` re-exports Koala theme.
- Existing Button/Input/Modal/… remain here until call sites migrate fully to `components/koala/primitives`.
- Do not add new Sentry-only styling. Prefer koala tokens (`#F84416`, DM Sans).

See [`../koala/REGISTRY.md`](../koala/REGISTRY.md).
