# Wave A3 Delete Manifest

Owner confirmed: yes

| File | Reason | Replacement | Verified by (gate 1–9) | Owner | PR |
|------|--------|-------------|------------------------|-------|-----|
| `__tests__/components/Keyword.test.tsx` | Tests deleted Keyword component | n/a | 1–9 | Ranksmile | local cleanup-a3 |
| `components/ui/index.ts` (+ folder) | Deprecated barrel; only barrel test imports it | `components/koala` / `koala/core` | 1–9 | Ranksmile | local cleanup-a3 |
| `__tests__/ui/barrel.test.ts` | Tests deleted ui barrel | n/a | 1–9 | Ranksmile | local cleanup-a3 |
| `lib/sentry-stubs/**` | Zero importers | n/a | 1–9 | Ranksmile | local cleanup-a3 |
| `utils/client/exportcsv.ts` | Zero importers (content-audit has local exportCSV) | page-local CSV helpers | 1–9 | Ranksmile | local cleanup-a3 |

**Manifest signed off:** yes — all rows complete.
