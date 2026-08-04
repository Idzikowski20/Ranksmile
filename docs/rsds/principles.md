# RSDS Principles

Ranksmile Design System for WordPress (`rsds-v1`). App Next.js uses Koala (React); this plugin uses **RSDS** (PHP + CSS).

## Non-negotiables

- Tokens-first — no magic numbers in components
- Scoped CSS only: `.ranksmile-admin`, `.ranksmile-sidebar`, `.ranksmile-elementor`
- No React/Emotion port from the app
- Legacy overrides are temporary (see ADR 0001)

## UX (SaaS-in-WP)

- **Dashboard-first** — Control Center is the landing page
- **Card-first** — Page → Sections → Cards → Components
- **Action-first** — every screen leads to an action
- Empty state instead of empty tables
- Status-driven UI (global Status System)
- Progressive disclosure (Advanced collapsed by default)
- Consistency over customization
- No duplicated navigation patterns

## Three questions per screen

1. What is the state?
2. What can I do?
3. What should I do next?
