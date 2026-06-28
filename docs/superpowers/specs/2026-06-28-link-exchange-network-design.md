# Package C — Internal Backlink Exchange Network (ABC pattern)

**Goal:** A network-effect backlink exchange between our customers' domains: when we generate/optimize an article for domain A, we insert one contextual, niche-relevant backlink to another customer's domain — using a non-reciprocal directed pattern (A→B, B→C, C→A) so links read as natural editorial mentions, not reciprocal swaps.

**Status:** Design 2026-06-28. Package C of the WordPress-integration roadmap. **Build after Packages A (GSC digest) and B (publish pipeline v2), and only once there is a critical mass of opted-in domains** — the network is worthless cold and grows in value with each member (that is the moat).

---

## 1. How the reference (BabyLoveGrowth) works — confirmed

- The publishing pipeline is the **vehicle**: they already generate daily articles for every customer, and place customers' backlinks *inside those articles*. No separate outreach.
- The pattern is the **ABC directed cycle** (A→B→C→A), **not reciprocal** (A↔B). Reciprocal links are trivially detectable and discounted by Google as a link scheme; one-directional links inside relevant editorial content have a far smaller footprint.
- **Matching** is niche/industry + geo/language relevant, against a pool of vetted domains (quality + topical relevance). Placements are **contextual/editorial** (in body), not footer/sidebar. Throughput ~a handful of links/month/site. Opt-in; "everyone gives and receives".

We have the same vehicle (we generate + publish articles to customers' WordPress sites) plus org/workspace/domain tenancy, a topics/keywords store, and an internal-links system — so most ingredients already exist.

---

## 2. Decisions (defaults; review before plan)

1. **Opt-in unit:** the **domain** joins the network (a per-domain toggle, explicit consent — the domain's generated articles will carry one outbound link to another member, and it will receive links from others).
2. **Pattern:** **non-reciprocal, constraint-enforced.** We never create A→B if B→A already exists (recently). Rings (A→B→C→A) emerge from the constraints rather than being precomputed.
3. **Placement vehicle:** insert **exactly one** contextual backlink into an article we generate/optimize for the giver, pointing to a matched receiver. Only in fresh/optimized content — never retro-edit old posts.
4. **Matching:** same **niche** + **language** (+ optional geo), relevance via existing topics/keywords; only **active, published, opted-in** domains above a quality floor are eligible.
5. **Fairness ledger:** credit balance per member (`given − received`). You must give to receive; matching prefers members with a positive give-surplus. Caps: ≤1 exchange link per article, per-target cooldown (no same target twice within N weeks), per-domain frequency cap.
6. **Anchors:** varied per placement — branded / partial-match / generic / raw-URL — chosen to read naturally; never keyword-stuffed exact-match every time.
7. **Link rel:** **dofollow** by default (the point), with a per-domain option to receive/give nofollow only.
8. **Transparency:** a "Link network" dashboard — given vs received, every placement (article, target, anchor, live status), and a one-click leave. Leaving stops new placements (existing ones already published remain unless separately removed).
9. **Cold-start:** if no eligible match exists, **skip injection** — never force a low-relevance/bad-neighborhood link.

**Explicit risk note (must surface in UI + onboarding):** this is a link exchange. Google's guidelines treat link exchanges as a potential link scheme. The ABC pattern + topical relevance + editorial placement + strict caps materially reduce the footprint and risk (which is why it works in practice), but do not eliminate policy risk. Participation is opt-in and clearly disclosed.

---

## 3. Architecture

```
opt-in (per domain) ──► link_exchange_members (niche, language, geo, quality, credits)
                              │
article generate/optimize ───►│ lib/linkExchange.ts  pickReceiver(giverDomain)
for giver A                   │   - eligible: same niche+lang, opted-in, published, quality≥floor
                              │   - exclude: self, reciprocal (B→A exists), recent same-target,
                              │              frequency-capped, balance rules
                              ▼
                    inject ONE contextual link (anchor strategy) into the article body
                              │
                              ▼
                    link_exchange_placements (giver, receiver, article, url, anchor, status)
                              │
        ┌─────────────────────┼───────────────────────┐
        ▼                     ▼                        ▼
  credits update      "Link network" dashboard   periodic live-link checker (cron)
  (give/receive)      (given/received/placements) (verify the link is still live; mark removed)
```

Single matching brain (`lib/linkExchange.ts`) used by the injection hook and (read-only) by the dashboard.

---

## 4. Components

### 4.1 Schema — `lib/ensureLinkExchangeTables.ts` (idempotent)
- `link_exchange_members`: `domain_id (unique), niche TEXT, language TEXT, geo TEXT, quality_score INTEGER, allow_dofollow BOOLEAN, status ('active'|'paused'), credits INTEGER DEFAULT 0, joined_at`.
- `link_exchange_placements`: `id, giver_domain_id, receiver_domain_id, article_id, target_url TEXT, anchor TEXT, rel ('dofollow'|'nofollow'), status ('placed'|'live'|'removed'), created_at, live_checked_at`.
- Indexes: `(receiver_domain_id)`, `(giver_domain_id, created_at)`, unique `(giver_domain_id, receiver_domain_id, article_id)`.

### 4.2 Membership — `lib/linkExchangeMembers.ts`
`joinNetwork(domainId, {niche, language, geo, allowDofollow})`, `leaveNetwork(domainId)`, `getMember(domainId)`, `listEligibleReceivers(forDomainId)` (the SQL eligibility filter). Niche/language default from the domain's existing brand_knowledge / site_context; user-overridable.

### 4.3 Matching — `lib/linkExchange.ts` (pure-ish; DB read for candidates)
`pickReceiver(giver): Promise<{ receiverDomainId, targetUrl, anchor } | null>`:
- candidates = eligible receivers (same niche+language, active, published, quality≥floor) minus: self; any B where `B→A` exists within the reciprocity window; any target placed for this giver within the cooldown; frequency-capped givers.
- rank by: receiver's credit need (received < given), topical similarity (shared topics/keywords), then random tiebreak.
- choose a **target URL** on the receiver (its homepage or a relevant published page) and an **anchor** via the anchor-strategy rotation.
- returns `null` when no candidate qualifies (cold-start safe).

### 4.4 Injection — hook in the article generate/optimize path
After content is produced for a giver domain in the network, call `pickReceiver`; if non-null, insert one in-body contextual link (sentence-aware placement near a relevant phrase; fall back to a natural "related resource" line), write a `link_exchange_placements` row (`status='placed'`), and adjust credits (giver +1 given, receiver +1 received). One link per article max.

### 4.5 Live-link checker — cron (extends the weekly/daily cron)
Periodically fetch published giver articles (or the receiver-facing record) and verify the placed link is still present; flip `status` to `live`/`removed`; optionally re-credit when a link is removed (anti-cheat).

### 4.6 Dashboard — "Link network" page (per workspace/org)
Opt-in toggle + niche/language config; cards: links given, links received, credit balance; table of placements (article, target domain, anchor, status, date); leave button. Onboarding copy with the explicit risk disclosure.

---

## 5. Error handling
- No eligible match → skip injection silently (logged), never insert a bad link.
- Injection failure → the article still publishes without an exchange link; no placement row written.
- Matching/DB errors isolated per article (never block content generation).
- Live-checker failures per-URL isolated; transient fetch errors do not flip status to `removed`.

## 6. Testing
- Unit: `pickReceiver` candidate filtering (excludes self, reciprocal, cooldown, frequency cap; respects niche+language; returns null on empty) against fixtures.
- Unit: anchor-strategy rotation (varies across calls; valid types).
- Unit: credit accounting (give/receive deltas; remove → re-credit).
- Integration (scratch script): seed a few members, run injection on a sample article, assert exactly one link inserted + one placement row + credits updated.

## 7. Out of scope / future
- External (non-customer) partner domains, paid placements, removal of already-published links on leave, multi-link-per-article, and DA/quality scoring via a 3rd-party API (start with a simple internal quality floor). Cross-language matching.

## 8. Prerequisites (why this is last)
- Package B (robust publish pipeline) so injected links reliably reach live WP posts.
- A critical mass of opted-in domains per niche — until then most `pickReceiver` calls return null. Ship the membership + dashboard first (collect opt-ins), enable injection once density exists.

## 9. File map
- Create: `lib/ensureLinkExchangeTables.ts`, `lib/linkExchangeMembers.ts`, `lib/linkExchange.ts`, `lib/linkExchangeAnchors.ts`, API routes (`pages/api/link-network/*`), dashboard page/component, cron live-checker block, tests in `__tests__/lib/`.
- Modify: the article generate/optimize path (injection hook); the cron file (live-link checker).
