# ADR 0001: Legacy overrides are temporary

## Status

Accepted

## Context

During migration from Surfer-era CSS, some old class names must keep working.

## Decision

`assets/design/overrides/legacy.css` may only contain temporary bridges.

Every rule **must** include:

```css
/* TODO(rsds): remove after <template|issue> — expiry YYYY-MM-DD */
```

Rules without TODO + expiry are rejected in review.

## Consequences

Legacy must trend toward ~0 lines after template migration. New styles go into tokens / theme / components — never into legacy as a permanent home.
