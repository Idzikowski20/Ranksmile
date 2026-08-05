# Deprecation checklist — Koala redesign wave

Mark deleted after Phase 3 cleanup PR.

| Legacy | Replacement | Delete after |
|--------|-------------|--------------|
| `components/common/SecretField.tsx` | `FormField` + `Input` `revealable` | Phase 3 |
| Ad-hoc password UI in AuthField | `Input` `revealable` | Phase 3 |
| Local `<input type="file">` in settings | `FileUpload` | Phase 2 (done where migrated) |
| Local SharePopover portal body | removed (share feature deleted) | — |
| `components/koala/core/form.tsx` shim | `components/koala/forms` | Phase 3 |
| `components/koala/core/input` shim | `primitives/Input` | Phase 3 |
| `CompactSelect` for simple menus | `Select` / `MenuList` | Phase 3 (evaluate) |

Status: migrations in progress; do not leave shims forever.
