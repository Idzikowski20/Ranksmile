# RSDS Components

CSS under `wordpress-plugin/assets/design/components/`. Markup helpers in PHP templates / `includes/admin/rsds/`.

| Module | Root classes |
|--------|----------------|
| button | `.rs-btn`, `.rs-btn--primary`, `.rs-btn--secondary` |
| card | `.rs-card`, `.rs-card__header`, `.rs-card__body` |
| field | `.rs-field`, `.rs-input`, `.rs-label` |
| notice | `.rs-notice`, `.rs-notice--*` |
| badge | `.rs-badge`, `.rs-badge--*` |
| wizard | `.rs-wizard`, `[data-rs-wizard-state]` |
| shell | `.rs-shell`, `.rs-shell__header`, `.rs-shell__body` |
| nav | `.rs-nav`, `.rs-nav__group`, `.rs-nav__link` |
| status | `.rs-status`, `.rs-status--{connected\|…}` |
| empty | `.rs-empty` |
| skeleton | `.rs-skeleton` |
| action-bar | `.rs-action-bar` |

All selectors must be nested under `.ranksmile-admin` (or sidebar/elementor scopes).
