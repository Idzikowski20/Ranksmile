# Wave A1 Delete Manifest

Owner confirmed: yes (no planned use of legacy `components/charts` or ChartSlim/Modal/shimmer shims)

| File | Reason | Replacement | Verified by (gate 1–9) | Owner | PR |
|------|--------|-------------|------------------------|-------|-----|
| `components/charts/**` | Dead legacy visx chart kit; ESLint already bans imports | `components/koala/charts` Chart/Sparkline | 1–9 | Ranksmile | local cleanup-a1 |
| `components/common/ChartSlim.tsx` | Only used by dead keywords/ideas | Koala Chart / Sparkline | 1–9 | Ranksmile | local cleanup-a1 |
| `components/common/Modal.tsx` | Only used by dead keywords/DomainSettings + obsolete test | `components/koala` Modal | 1–9 | Ranksmile | local cleanup-a1 |
| `components/shimmering-text.tsx` | Only imported by `components/charts` | n/a (charts removed) | 1–9 | Ranksmile | local cleanup-a1 |
| `__tests__/components/Modal.test.tsx` | Tests deleted Modal | n/a | 1–9 | Ranksmile | local cleanup-a1 |

**Manifest signed off:** yes — all rows complete.
