# Ranksmile — local Strix rules of engagement

## Authorization
Only test https://ranksmile.pl and the provided local Ranksmile source tree.
Do not attack third-party SaaS (Stripe Dashboard, Neon Console, Resend, Google, Ably).
Avoid DoS, mass email spam, and live Stripe charges.

## Priorities
1. Broken access control / IDOR across multi-tenant orgs (org_id, domain slug, article id, member id)
2. Auth bypass on /api/*, privilege escalation (member → manage/billing)
3. Stripe webhook forgery (POST /api/webhooks/stripe) and CRON_SECRET abuse (/api/cron/*)
4. SSRF via URL fields (site audit, fetch links, render-page) toward internal hosts
5. Billing entitlement bypass (incomplete treated as paid)
6. WordPress plugin API /api/v1/wordpress/* token isolation

## Stack
Next.js Pages Router, Neon Auth (email/password + Google), session cookies, Railway, Redis/BullMQ, Stripe Payment Element, private Python sidecar.

## Auth surfaces
- Sign-in: https://ranksmile.pl/auth/sign-in
- Auth proxy: /api/auth/*
- Session bootstrap: /api/session/bootstrap

If no credentials are provided, do unauthenticated recon + source-assisted analysis of authz patterns; report likely IDOR candidates with concrete request shapes.

## High-value paths
Billing: POST /api/billing/create-subscription, /api/billing/portal
Webhooks: POST /api/webhooks/stripe
Cron: GET /api/cron/* with Bearer CRON_SECRET
Members/workspaces/domains/articles APIs under /api/*

Full brief: docs/strix-pentest-brief.md in the repo target.
