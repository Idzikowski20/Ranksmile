# Package A — GSC Weekly Traffic-Drop Digest (per-organization)

**Goal:** A weekly email digest (per organization) that flags pages whose Google Search Console ranking dropped across meaningful thresholds (not raw %), plus a "Traffic drop" badge in the app — modeled on SurferSEO's drop monitor.

**Status:** Design approved 2026-06-28. Decomposed from a 7-feature request; this is Package A (Package B = Publish Pipeline v2, separate spec).

---

## 1. Background & key decisions

SurferSEO's WP plugin (`class-surfer-gsc-drop-monitor.php`) runs a weekly cron that snapshots per-post GSC data, computes week-over-week (WoW) change, and emails a digest of **threshold transitions** (was top-10 and fell, dropped to the next 10-block, fell out of index, grew). The actionable insight is the *tier transition*, not "−7.2%". None of the other analyzed plugins (BabyLoveGrowth, RankPill, Soro) do anything like this — it is a genuine differentiator.

**Decisions (from brainstorming):**
- **Granularity:** per-page threshold transitions **plus** a domain-level clicks/impressions WoW summary.
- **Recipients:** all **active organization members**, one email per org, listing which domains dropped. Throttle: max 1 email / 7 days / org.
- **Badge:** "Traffic drop" on the dashboard (alerts section) + domain rows (workspace list) + per-page rows (content-audit).
- **Approach:** persist weekly snapshots in a table; compute deltas/tiers in a shared lib used by both the email and the badge API.

**Hard constraint:** WoW on thresholds requires snapshot history. The app only keeps rolling 30-day GSC JSON, so snapshots accumulate **from now forward** — the first real digest is possible only after **2 weeks** (week 1 = baseline). The UI must communicate this ("collecting data — first report in X days").

---

## 2. Existing building blocks (confirmed)

- **Cron:** `pages/api/cron/daily.ts` (Vercel Cron + `CRON_SECRET` bearer). Runs daily; no weekly logic yet.
- **Email:** `lib/sendMail.ts` — `sendMail({ to, subject, html })`, SMTP from app settings. Digest precedent: `pages/api/notify.ts`; HTML builder precedent: `utils/generateEmail.ts`; template style: `lib/inviteEmail.ts` (inline styles, tokens).
- **GSC data:** `utils/searchConsole.ts` `readLocalSCData(domain)` → JSON at `data/SC_<domain>.json`. Per-page items in `sevenDays`/`thirtyDays`: `{ keyword, uid, device, country, clicks, impressions, ctr, position, page }`. **No weekly snapshot store** (the gap this package fills).
- **Tenancy:** `organizations → workspaces → domain (1:1)`. Org members in `organization_members` (`org_id, user_id, email, role, status, workspace_ids`). Helpers in `lib/tenancy.ts`, `lib/organization.ts`. GSC OAuth is per-user (`lib/gscAccounts.ts`).

---

## 3. Architecture

```
Vercel daily cron ──(Monday guard)──► capture weekly snapshots (per domain, per page)
                                          │
                                          ▼
                              lib/gscDrops.ts  (this-week vs last-week → tiers + summary)
                                   │                         │
                                   ▼                         ▼
                       lib/gscDigestEmail.ts        /api/gsc/traffic-alerts
                       (per-org HTML, all members)  (badge data: dashboard + lists)
```

Single detection source (`lib/gscDrops.ts`) feeds both email and badge — no divergence.

---

## 4. Components

### 4.1 Schema — `lib/ensureGscSnapshotTables.ts` (idempotent)
```
CREATE TABLE IF NOT EXISTS gsc_page_snapshots (
  id          <PK>,
  domain_id   INTEGER NOT NULL,
  page        TEXT NOT NULL,          -- stripped path, matching readLocalSCData `page`
  week_start  DATE NOT NULL,          -- Monday of the captured (previous full) week
  clicks      INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  position    REAL,                   -- impression-weighted avg
  captured_at TIMESTAMP DEFAULT <NOW>
);
-- UNIQUE(domain_id, page, week_start); INDEX(domain_id, week_start)
ALTER TABLE organizations ADD COLUMN last_gsc_digest_sent_at TIMESTAMP;  -- throttle
```
Postgres/SQLite dialect handled like other ensure files (`SERIAL` vs `AUTOINCREMENT`, idempotent ALTER in try/catch).

### 4.2 Snapshot capture — `lib/gscSnapshots.ts`
- `weekStartFor(date)` → Monday (UTC) of the previous full week.
- `captureWeeklySnapshot(domain, domainId, weekStart)`: read `readLocalSCData(domain)`; aggregate `sevenDays` **per `page`** — sum clicks/impressions across device+country rows, position = Σ(position·impressions)/Σ(impressions) (fallback to simple avg when impressions=0); upsert one row per `(domain_id, page, weekStart)`.
- `getSnapshot(domainId, weekStart)` → `Map<page, {clicks,impressions,position}>`.

### 4.3 Drop detection — `lib/gscDrops.ts` (pure, unit-tested)
Input: `now: Map<page,Snap>`, `prev: Map<page,Snap>`. Position semantics: **lower = better** (GSC avg rank).
- **droppedInTop10**: prev.pos ≤ 10 and now.pos > prev.pos
- **droppedATier**: prev.pos in (10, 50], now.pos > prev.pos, and `floor((now.pos-1)/10) !== floor((prev.pos-1)/10)`
- **outOfIndex**: page in `prev`, absent in `now`
- **growth**: now.pos ≤ prev.pos − 2 and now.pos ≤ 50 (optional `optimizedByUs` flag when the page maps to one of our articles)
- **domain summary**: ΣClicks/ΣImpressions now vs prev (WoW % per metric), counts of pages fell/grew.
Output: `{ tiers: { droppedInTop10[], droppedATier[], outOfIndex[], growth[] }, summary }` where each entry carries `{ page, prevPos, nowPos, clicks, prevClicks }`.

### 4.4 Cron — weekly block in `pages/api/cron/daily.ts`
Guard: `new Date().getUTCDay() === 1` (Monday) AND no snapshot exists for this week.
1. For each domain with GSC data: `captureWeeklySnapshot(...)`. Per-domain try/catch (one failure never blocks the rest).
2. For each organization: gather its domains; for each, `computeDrops(now, prev)`; collect domains that have ≥1 drop-tier entry.
3. If the org has any drops AND `last_gsc_digest_sent_at < now − 7d` AND ≥1 active member email exists: build HTML, `sendMail` to all active members (`organization_members.status='active'`), set `last_gsc_digest_sent_at` **only on success**.
4. Baseline week (no `prev` snapshot for a domain) → that domain contributes nothing; org with only baselines sends nothing.

### 4.5 Email — `lib/gscDigestEmail.ts`
Pure HTML builder `buildGscDigest({ orgName, domains: DomainDrops[] }) → string`. Inline styles, design.md tokens (`#18181B`, `#52525C`, `#783AFB`, success `#1AB25E`, error `#FF6F77`, card border `#E4E4E7`). Structure: org header → per-domain card: title + "Clicks −Y% · Impressions −Z% WoW" → sub-lists *Dropped in top 10 / Dropped a tier / Out of index / Growth*, each row `page  ·  prev→now`. Subject: `Weekly search report — {orgName}`.

### 4.6 Badge API + UI
- `pages/api/gsc/traffic-alerts.ts` (GET, workspace-scoped via `getAccessibleWorkspaceIds`): returns, for the active workspace's domain(s), this-week drop entries from `gscDrops` (+ a `collecting` flag when <2 weeks of snapshots).
- UI (implemented later via `/frontend-design`, design.md tokens):
  - **Dashboard**: "Traffic alerts" section listing dropped pages (or the "collecting data — first report in X days" state).
  - **Domain rows** (workspace list/sidebar): "Traffic drop" badge when the domain has drops.
  - **Content-audit** per-page rows: "Traffic drop" badge on dropped URLs.

---

## 5. Error handling
- Cron resilient per-domain and per-org (isolated try/catch; log + continue).
- No GSC data / unreadable JSON for a domain → skip that domain.
- Email send failure → log, do **not** set throttle (retries next eligible run).
- Snapshot upsert idempotent (unique key) — a re-run on the same Monday is a no-op.

## 6. Testing
- **Unit:** `lib/gscDrops.ts` against fixtures (prev/now position maps → expected tier buckets, incl. boundary cases: 10↔11, 20↔21, present→absent, absent→present, growth ≥2).
- **Script:** snapshot capture run against a real `data/SC_<domain>.json` (verify per-page aggregation + weighted position).
- **Email:** render `buildGscDigest` with a fixture to a static HTML file for visual check; no live send in tests.

## 7. Out of scope (this package)
Publish-pipeline work (self-host images, Gutenberg blocks, SEO-meta sync, ACF, import/export logger) → **Package B**. Per-keyword (not per-page) alerts, Slack/webhook delivery, and configurable thresholds → future.

## 8. File map
- Create: `lib/ensureGscSnapshotTables.ts`, `lib/gscSnapshots.ts`, `lib/gscDrops.ts`, `lib/gscDigestEmail.ts`, `pages/api/gsc/traffic-alerts.ts`, `lib/gscDrops.test.ts` (or `__tests__`).
- Modify: `pages/api/cron/daily.ts` (weekly block), dashboard + domain-list + content-audit components (badge), `organizations` schema.
