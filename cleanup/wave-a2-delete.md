# Wave A2 Delete Manifest

Owner confirmed: yes (live keyword UX is rankTracking / keywordResearch / organic; these folders have no page importers)

| File | Reason | Replacement | Verified by (gate 1–9) | Owner | PR |
|------|--------|-------------|------------------------|-------|-----|
| `components/keywords/**` | Zero page/static importers (only obsolete Keyword.test) | TrackedKeywordsTable, keywordResearch, OrganicKeywordsTable | 1–9 | Ranksmile | local cleanup-a2 |
| `components/ideas/**` | Zero page importers; only self + adwords hooks | keyword research / DataForSEO flows | 1–9 | Ranksmile | local cleanup-a2 |
| `components/insight/**` | Zero importers; utils/insight stays | utils/insight + email generators | 1–9 | Ranksmile | local cleanup-a2 |
| `components/domains/DomainSettings.tsx` | Component unused; type DomainSettings remains in types.d.ts | domain setup wizard / API types | 1–9 | Ranksmile | local cleanup-a2 |

**Manifest signed off:** yes — all rows complete.
