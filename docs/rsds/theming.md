# RSDS Theming

```html
<div class="ranksmile-admin" data-theme="light">
```

## Theme API

- `:root` and `[data-theme="light"]` — production Light values
- `[data-theme="dark"]` — structural mirror only (no polished dark UI in rsds-v1)

Do not auto-switch via `prefers-color-scheme` yet.

Override tokens only in `themes/theme.css`, never in random components.
