# Cleanup Completion Criteria

Cleanup complete when:

- [x] All delete manifests resolved and **signed off** (`wave-a1` … `wave-b`)
- [x] No deprecated modules left **in delete scope** (gallery remains deprecated — documented e2e KEEP exception)
- [x] Cleanup Freeze: forbidden legacy imports via ESLint `no-restricted-imports`
- [x] Token debt budget updated + history entry for wave `c3`
- [x] Dead exports budget established (`npm run dead:exports` / `dead:exports:write`)
- [x] Metrics published (`cleanup/metrics.md`)
- [x] Rollback identifiable per wave (local commits / manifests; tags optional)
- [x] Targeted smoke: `keywordHelpers` tests + `check:koala-tokens` green

Notes:

- Full `test:ci`: 212 passed / 40 failed — failures are pre-existing (Sequelize/uuid ESM, auth mock expectations), not cleanup import breaks.
- `typecheck`: 2 pre-existing errors in `lib/billingConfirmation.ts` / `lib/billingInvoiceModel.ts` (untouched by cleanup).
- Hard KEEP: `utils/searchConsole.ts`, TipTap/articles editor, koala gallery + `/dev/koala-gallery` until e2e retarget.
