# Archived scripts

One-off debug, repair, and migration tooling moved out of the active `scripts/` root during ponytail cleanup (2026-08-02).

## Why archived

These were not wired in `package.json` or CI. Keeping them avoids losing tribal knowledge while making the active scripts tree smaller and safer to browse.

## When they may be deleted

Safe to hard-delete an entry **12 months after archive date** if nobody has restored or referenced it (default review: **2027-08-02**).

| Path | Archived | Notes |
|------|----------|-------|
| `debug-*.mjs` | 2026-08-02 | Article / AI Vis / DFS ad-hoc debugging |
| `repair-*.mjs` | 2026-08-02 | One-off article term / AI score repair |
| `migrate-koala-imports.js` | 2026-08-02 | Import path migration; completed |
| `cognee-cloud-mcp/` | 2026-08-02 | Optional local MCP package |

Do not reintroduce these into CI without an owner and a documented purpose.
