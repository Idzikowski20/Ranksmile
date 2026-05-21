# Surfer: AI Visibility Platform

## Mission
Create implementation-ready, token-driven UI guidance for Surfer: AI Visibility Platform that is optimized for consistency, accessibility, and fast delivery across marketing site.

## Brand
- Product/brand: Surfer: AI Visibility Platform
- URL: https://surferseo.com/
- Audience: authenticated users and operators
- Product surface: marketing site

## Style Foundations
- Visual style: clean, functional, implementation-oriented
- Main font style: `font.family.primary=Inter Variable`, `font.family.stack=Inter Variable, Arial, sans-serif`, `font.size.base=14px`, `font.weight.base=400`, `font.lineHeight.base=21px`
- Typography scale: `font.size.xs=12.25px`, `font.size.sm=14px`, `font.size.md=15.4px`, `font.size.lg=17.5px`, `font.size.xl=19.88px`, `font.size.2xl=21px`, `font.size.3xl=28px`, `font.size.4xl=35px`
- Color palette: `color.text.primary=#ffffff`, `color.surface.base=#000000`, `color.text.tertiary=#ff5b49`, `color.text.inverse=color(srgb 0 0 0 / 0.5)`, `color.surface.raised=#783afb`, `color.surface.strong=#09090b`, `color.border.strong=#221e28`
- Spacing scale: `space.1=3.5px`, `space.2=4.2px`, `space.3=5.6px`, `space.4=7px`, `space.5=10.5px`, `space.6=14px`, `space.7=21px`, `space.8=28px`
- Radius/shadow/motion tokens: `radius.xs=7px`, `radius.sm=10.5px`, `radius.md=14px`, `radius.lg=21px`, `radius.xl=50px`, `radius.2xl=70px` | `shadow.1=rgba(0, 0, 0, 0.05) 0px 1px 1px 0px, rgba(34, 42, 53, 0.04) 0px 4px 6px 0px, rgba(47, 48, 55, 0.05) 0px 24px 68px 0px, rgba(0, 0, 0, 0.04) 0px 2px 3px 0px`, `shadow.2=rgba(0, 0, 0, 0.2) 0px -1px 0px 0px inset, rgba(255, 255, 255, 0.25) 0px 1px 0px 0px inset` | `motion.duration.instant=150ms`, `motion.duration.fast=200ms`, `motion.duration.normal=300ms`, `motion.duration.slow=500ms`

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
Concise, confident, implementation-focused.

## Rules: Do
- Use semantic tokens, not raw hex values, in component guidance.
- Every component must define states for default, hover, focus-visible, active, disabled, loading, and error.
- Component behavior should specify responsive and edge-case handling.
- Interactive components must document keyboard, pointer, and touch behavior.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.
- Do not ship component guidance without explicit state rules.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and semantic tokens.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with a QA checklist.

## Required Output Structure
- Context and goals.
- Design tokens and foundations.
- Component-level rules (anatomy, variants, states, responsive behavior).
- Accessibility requirements and testable acceptance criteria.
- Content and tone standards with examples.
- Anti-patterns and prohibited implementations.
- QA checklist.

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.
- Include known page component density: links (219), cards (216), buttons (107), lists (39), inputs (7), tables (5), navigation (2).


## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Teams should prefer system consistency over local visual exceptions.
