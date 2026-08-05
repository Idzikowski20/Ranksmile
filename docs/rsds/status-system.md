# RSDS Status System

Canonical statuses for API · Articles · GSC · Sync · Integrations:

| Status | Meaning |
|--------|---------|
| `connected` | Healthy |
| `disconnected` | Not linked |
| `syncing` | In progress |
| `warning` | Partial issue |
| `error` | Blocking failure |
| `disabled` | Turned off |

Each status exposes: **icon · RSDS color · description · suggested action**.

PHP: `Ranksmile\Admin\RSDS\Status`  
CSS: `.rs-status--{status}` under `.ranksmile-admin`

No per-screen reinvented status badges.
