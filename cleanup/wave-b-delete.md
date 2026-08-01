# Wave B Delete / Archive Manifest

Owner confirmed: yes

## Deletes

| File | Reason | Replacement | Verified by (gate 1–9) | Owner | PR |
|------|--------|-------------|------------------------|-------|-----|
| `pages/api/ideas.ts` | Only callers were deleted ideas UI + `services/adwords`; no cron/queue/flags | article keyword-suggest + DataForSEO keyword research | 1–8 runtime/flags/env clear; 9 owner | Ranksmile | local cleanup-b |
| `services/adwords.tsx` | Client hooks only for deleted ideas UI; `utils/adwords` + `/api/adwords` KEEP | utils/adwords, pages/api/adwords | 1–9 | Ranksmile | local cleanup-b |
| `services/searchConsole.ts` | Zero importers; `utils/searchConsole.ts` KEEP | utils/searchConsole + GSC APIs | 1–9 | Ranksmile | local cleanup-b |

## Archive (not delete)

| File | Reason | Replacement | Verified by | Owner | PR |
|------|--------|-------------|-------------|-------|-----|
| `scripts/debug-*.mjs` | One-off debug | `scripts/archive/` | n/a | Ranksmile | local cleanup-b |
| `scripts/repair-*.mjs` | One-off repair | `scripts/archive/` | n/a | Ranksmile | local cleanup-b |
| `scripts/migrate-koala-imports.js` | Migration complete | `scripts/archive/` | n/a | Ranksmile | local cleanup-b |
| `scripts/cognee-cloud-mcp/**` | Optional MCP tooling | `scripts/archive/cognee-cloud-mcp/` | n/a | Ranksmile | local cleanup-b |

## KEEP (deprecated)

| File | Policy |
|------|--------|
| `pages/dev/koala-gallery.tsx` + `components/koala/gallery` | `@deprecated`; e2e smoke/visual still hit `/dev/koala-gallery` |

**Manifest signed off:** yes — all rows complete.
