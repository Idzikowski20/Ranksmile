# Topical Map (SurferSEO 1:1 + Extensions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/sites/[domain]/topical-map` as a 1:1 SurferSEO Topical Map — two-panel cluster/keyword list, radar "Map" SVG view, "IDEA" detail slide-over — extended with Overview/Opportunity/AI-Gap insights.

**Architecture:** A pure data adapter (`lib/topicalMap.ts`) derives every rich signal (keywords, KD/Vol, coverage, competitors, opportunity, AI gap) from a stable FNV-1a hash of each topic title, because the backend only stores `{id,title,summary}` per topic. Three presentation units consume it: the page (header/toolbar/two-panel list), a detail slide-over, and a hand-rolled SVG radar canvas. Existing `components/ui` primitives are reused throughout; the adapter is the single swap point when the real coverage engine (lib/aiCoverage, python-sidecar) starts emitting these signals.

**Tech Stack:** Next.js 12 (pages router), React 18, react-query v3, Jest (`__tests__/`), inline styles per `design.md`, Puppeteer (already in node_modules) for headless UI verification. No new dependencies.

## Global Constraints

- `design.md` is the source of truth: font is always `var(--font-family-primary)`; use only colors named in design.md or this plan; new code uses **inline styles** (no new Tailwind classes); icons are **inline SVG** with `aria-hidden="true"`; dropdowns use `animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)'` and `zIndex: 150`; interactive elements define hover states with min 150ms transitions.
- Reuse `components/ui` (Tabs, SortableHeader, SearchBar, Toggle, Checkbox, Skeleton) — do not create parallel primitives.
- All demo data must be **deterministic** — no `Math.random`, no `Date.now` in `lib/topicalMap.ts` or in render paths.
- The repo root is `C:\Users\patry\Desktop\serpbear`; shell is Git Bash (`cd /c/Users/patry/Desktop/serpbear`).
- UI verification runs a dev server on **port 3112** plus a Puppeteer probe executed **from the repo root** (`node __probe.js "<outdir>"`, then delete `__probe.js`). Probe intercepts `/api/domains*` requests to inject fake topics (steps show the full script).
- Auth bypass for probes: `sed -i "s#|| path.startsWith('/invite');#|| path.startsWith('/invite') || path.startsWith('/sites') /* TEMP-PROBE */;#" pages/_app.tsx`. Revert with `sed -i "s# || path.startsWith('/sites') /\\* TEMP-PROBE \\*/;#;#" pages/_app.tsx`. **Every commit step is preceded by a grep check that TEMP-PROBE is gone.**
- Do NOT modify `pages/api/**` or the database — this feature is UI + adapter only.
- Do NOT modify `pages/billing/**` or `pages/_app.tsx` (beyond the temporary probe bypass).
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## File Structure

| File | Responsibility |
|---|---|
| `lib/topicalMap.ts` (create) | Types + deterministic adapter `buildTopicClusters()` — the ONLY place demo signals are derived. |
| `__tests__/lib/topicalMap.test.ts` (create) | Jest unit tests for the adapter. |
| `pages/sites/[domain]/topical-map.tsx` (rewrite) | Page: header row, toolbar (Tabs/Show titles/Filters/Search), two-panel list, view switch, wiring. |
| `components/domains/TopicalFilters.tsx` (create) | Filters popover + `applyTopicalFilters()` pure filter fn + `TopicalFilterState`. |
| `components/domains/TopicalClusterPanel.tsx` (create) | "IDEA" slide-over: stats grid, tabs Keywords/Competitors (+Overview in Task 6). |
| `lib/topicalMapGeometry.ts` (create) | Pure geometry + palette constants/functions for the radar canvas (ring radii, axis offsets, hex paths, coverage colors) — extracted so `TopicalMapCanvas.tsx` stays render logic only, and every constant is testable and cross-checked against the reference SVG in one place. |
| `__tests__/lib/topicalMapGeometry.test.ts` (create) | Jest unit tests for `ringRadius`/`nodeCenter`. |
| `components/domains/TopicalMapCanvas.tsx` (create) | SVG radar: rings, rotated axes, hex nodes, legend card, zoom, tooltip, selected-cluster card. Imports constants from `lib/topicalMapGeometry`. |
| `components/ui/Tabs.tsx` (modify) | Widen `label` prop from `string` to `React.ReactNode` (needed for the hex-icon "Map" tab). |

Existing components consumed (do not modify): `components/ui/index.ts` exports `Tabs`, `Toggle`, `SearchBar`, `SortableHeader`, `Checkbox`, `Skeleton`; `lib/useSortState` (`const { sortKey, sortDir, handleSort } = useSortState<K>('initialKey')`, `SortDir = 'asc' | 'desc'`); `components/domains/DomainSubLayout.tsx` (`domain, slug, section, actions?, contentMaxWidth?` — renders breadcrumb header + white scroll area); `components/common/AppShell.tsx`.

Data reality (why the adapter exists): `GET /api/domains/[slug]/topics` returns `{ topics: Array<{ id, domain_id, title, summary, created_at }> }` — nothing else. KD/Vol/Position/keywords/competitors/coverage do NOT exist server-side.

---

### Task 1: Deterministic data adapter (`lib/topicalMap.ts`)

**Files:**
- Create: `lib/topicalMap.ts`
- Test: `__tests__/lib/topicalMap.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (used by Tasks 2–6): `buildTopicClusters(topics: Array<{id:number; title:string; summary?:string|null}>): TopicCluster[]`, plus exported types `TopicCluster`, `TopicKeyword`, `KeywordGroup`, `TopicCompetitor`, `CoverageDim`, `AiGapItem`, `Opportunity`, `TopicStatus`, `ArticleStatus` and helpers `hashStr(s:string):number`, `slugify(s:string):string`. Key `TopicCluster` fields: `id, name, mainKeyword, keywords[], groups[], competitors[] (always 20), kd, vol, position (number|null), impressions, covRatio ("1/1"), status ('covered'|'not_covered'|'recommended'), articleStatus, dims[7], aiGap[8], opportunity{score,tier,estGainClicks,difficulty,priority}, aiAuthority{score,subs[6]}, map{x,y∈[-1,1], size}`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/topicalMap.test.ts`:

```ts
import { buildTopicClusters, hashStr, slugify } from '../../lib/topicalMap';

const TOPICS = [
  { id: 1, title: 'Programowanie Webowe', summary: null },
  { id: 2, title: 'Aplikacje Mobilne', summary: null },
];

describe('topicalMap adapter', () => {
  it('is deterministic across calls', () => {
    expect(JSON.stringify(buildTopicClusters(TOPICS)))
      .toEqual(JSON.stringify(buildTopicClusters(TOPICS)));
  });

  it('derives main keyword and 3-5 keywords total', () => {
    const [c] = buildTopicClusters(TOPICS);
    expect(c.mainKeyword).toBe('programowanie webowe');
    expect(c.keywords[0].isMain).toBe(true);
    expect(c.keywords.length).toBeGreaterThanOrEqual(3);
    expect(c.keywords.length).toBeLessThanOrEqual(5);
  });

  it('keeps metrics in range', () => {
    for (const c of buildTopicClusters(TOPICS)) {
      expect(c.kd).toBeGreaterThanOrEqual(0);
      expect(c.kd).toBeLessThanOrEqual(100);
      expect(c.vol).toBeGreaterThan(0);
      expect(c.vol % 10).toBe(0);
      expect(Math.abs(c.map.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(c.map.y)).toBeLessThanOrEqual(1);
      expect(c.dims).toHaveLength(7);
      c.dims.forEach((d) => { expect(d.value).toBeGreaterThan(0); expect(d.value).toBeLessThan(100); });
      expect(c.aiGap).toHaveLength(8);
      c.aiGap.forEach((g) => expect(g.have).toBeLessThanOrEqual(g.total));
      expect(c.competitors).toHaveLength(20);
      expect(new Set(c.competitors.map((x) => x.domain)).size).toBe(20);
    }
  });

  it('groups covered keywords under a slug url and the rest under Not Covered', () => {
    for (const c of buildTopicClusters(TOPICS)) {
      const covered = c.keywords.filter((k) => k.covered);
      const urlGroup = c.groups.find((g) => g.url !== null);
      if (covered.length) {
        expect(urlGroup).toBeDefined();
        expect(urlGroup!.url).toBe(`/${slugify(c.name)}`);
      }
      if (c.keywords.some((k) => !k.covered)) {
        expect(c.groups.find((g) => g.url === null)!.label).toBe('Not Covered');
      }
    }
  });

  it('opportunity tier matches score', () => {
    for (const c of buildTopicClusters(TOPICS)) {
      const s = c.opportunity.score;
      const tier = s >= 80 ? 'Very High' : s >= 60 ? 'High' : s >= 40 ? 'Medium' : 'Low';
      expect(c.opportunity.tier).toBe(tier);
    }
  });

  it('hash/slug helpers are stable', () => {
    expect(hashStr('abc')).toBe(hashStr('abc'));
    expect(slugify('Tworzenie Aplikacji Webowych — kurs')).toBe('tworzenie-aplikacji-webowych-kurs');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/topicalMap.test.ts`
Expected: FAIL — `Cannot find module '../../lib/topicalMap'`

- [ ] **Step 3: Write the implementation**

Create `lib/topicalMap.ts`:

```ts
/**
 * Topical Map data adapter.
 *
 * The topics API (`/api/domains/[slug]/topics`) only stores { id, title, summary }.
 * Every richer signal the Topical Map UI shows — keywords, KD/volume, coverage,
 * competitors, opportunity, AI-gap — is derived HERE from a stable FNV-1a hash
 * of the topic title, so the UI renders consistent demo data with no randomness.
 * When the real coverage engine (lib/aiCoverage, python-sidecar) starts emitting
 * these signals, swap the internals of buildTopicClusters and the UI stays put.
 */

export type TopicStatus = 'covered' | 'not_covered' | 'recommended';
export type ArticleStatus = 'Not started' | 'In progress' | 'Done' | 'Covered';

export type TopicKeyword = {
   text: string;
   isMain: boolean;
   covered: boolean;
   position: number | null;
   kd: number;
   impressions: number | null;
   vol: number;
};

export type KeywordGroup = {
   /** URL path for covered groups (e.g. "/aplikacje-webowe"); null for "Not Covered". */
   url: string | null;
   label: string;
   keywords: TopicKeyword[];
};

export type TopicCompetitor = { domain: string; path: string; href: string };

export type CoverageDim = { label: string; value: number };
export type AiGapItem = { label: string; have: number; total: number };

export type Opportunity = {
   score: number;
   tier: 'Very High' | 'High' | 'Medium' | 'Low';
   estGainClicks: number;
   difficulty: 'Easy' | 'Medium' | 'Hard';
   priority: 'High' | 'Medium' | 'Low';
};

export type TopicCluster = {
   id: number;
   name: string;
   mainKeyword: string;
   keywords: TopicKeyword[];
   groups: KeywordGroup[];
   competitors: TopicCompetitor[];
   kd: number;
   vol: number;
   position: number | null;
   impressions: number;
   covRatio: string;
   status: TopicStatus;
   articleStatus: ArticleStatus;
   dims: CoverageDim[];
   aiGap: AiGapItem[];
   opportunity: Opportunity;
   aiAuthority: { score: number; subs: { label: string; value: number }[] };
   /** Radar position: x/y in [-1,1] (0,0 = center = High/High), size multiplier. */
   map: { x: number; y: number; size: number };
};

export const hashStr = (s: string): number => {
   let h = 2166136261;
   for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
   }
   return h >>> 0;
};

const unit = (seed: number, salt: number): number => (hashStr(`${seed}:${salt}`) % 10000) / 10000;
const between = (seed: number, salt: number, min: number, max: number): number => min + unit(seed, salt) * (max - min);
const round1 = (n: number): number => Math.round(n * 10) / 10;

export const slugify = (s: string): string => s
   .toLowerCase()
   .replace(/ł/g, 'l')
   .normalize('NFD')
   .replace(/[̀-ͯ]/g, '')
   .replace(/[^a-z0-9]+/g, '-')
   .replace(/(^-|-$)/g, '');

const COMPETITOR_POOL = [
   'pti.cs.pollub.pl', 'informatyka.orawskie.pl', 'sosw.poznan.pl', 'akanza.pl',
   'certyfikaty.byd.pl', 'imakeable.com', 'imoli.dev', 'impicode.pl',
   'it-solve.pl', 'kursykomputerowe.pl', 'pl.wikipedia.org', 'smartbees.pl',
   'solv.pl', 'strefakursow.pl', 'systemy-it.com', 'szkolareacta.pl',
   'thestory.is', 'a-creative.pl', 'abc-wiedzy.pl', 'usosweb.umk.pl',
];

const SUPPORT_TEMPLATES: Array<(m: string) => string> = [
   (m) => `programowanie ${m}`,
   (m) => `${m} kurs`,
   (m) => `jak wybrac ${m}`,
   (m) => `${m} dla firm`,
   (m) => `${m} przyklady`,
];

const DIM_LABELS = ['Coverage', 'SEO', 'AI Search', 'Authority', 'Freshness', 'Internal Links', 'Intent'];
const GAP_LABELS = ['Entities', 'Facts', 'Comparisons', 'Examples', 'Statistics', 'Definitions', 'FAQs', 'Citations'];
const AUTH_LABELS = ['Coverage', 'Trust', 'Freshness', 'Citation', 'Entity depth', 'Source quality'];

const buildKeywords = (seed: number, main: string, status: TopicStatus): TopicKeyword[] => {
   const supporting = 2 + (hashStr(`${seed}:kwc`) % 3); // 2..4
   const tplBase = hashStr(`${seed}:tb`) % SUPPORT_TEMPLATES.length;
   const kws: TopicKeyword[] = [{
      text: main,
      isMain: true,
      covered: status === 'covered',
      position: status === 'covered' ? round1(between(seed, 1, 3, 75)) : null,
      kd: Math.round(between(seed, 2, 0, 8)),
      impressions: status === 'covered' ? Math.round(between(seed, 3, 3, 220)) : null,
      vol: Math.round(between(seed, 4, 5, 90)) * 10,
   }];
   for (let i = 0; i < supporting; i += 1) {
      kws.push({
         text: SUPPORT_TEMPLATES[(tplBase + i) % SUPPORT_TEMPLATES.length](main),
         isMain: false,
         covered: false,
         position: null,
         kd: Math.round(between(seed, 10 + i, 0, 12)),
         impressions: null,
         vol: Math.round(between(seed, 20 + i, 5, 60)) * 10,
      });
   }
   return kws;
};

export function buildTopicClusters(
   topics: Array<{ id: number; title: string; summary?: string | null }>,
): TopicCluster[] {
   return topics.map((t, idx) => {
      const seed = hashStr(t.title.trim().toLowerCase());
      const u = unit(seed, 0);
      let status: TopicStatus = 'not_covered';
      if (u < 0.55) status = 'covered';
      else if (u < 0.8) status = 'recommended';

      const main = t.title.trim().toLowerCase();
      const keywords = buildKeywords(seed, main, status);
      const covered = keywords.filter((k) => k.covered);
      const notCovered = keywords.filter((k) => !k.covered);

      const vol = keywords.reduce((s, k) => s + k.vol, 0);
      const kd = round1(keywords.reduce((s, k) => s + k.kd, 0) / keywords.length);
      const impressions = covered.reduce((s, k) => s + (k.impressions || 0), 0);
      const position = covered.length
         ? round1(covered.reduce((s, k) => s + (k.position || 0), 0) / covered.length)
         : null;

      const slug = slugify(t.title);
      const groups: KeywordGroup[] = [];
      if (covered.length) groups.push({ url: `/${slug}`, label: `/${slug}`, keywords: covered });
      if (notCovered.length) groups.push({ url: null, label: 'Not Covered', keywords: notCovered });

      const start = hashStr(`${seed}:cmp`) % COMPETITOR_POOL.length;
      const competitors: TopicCompetitor[] = Array.from({ length: 20 }, (_, i) => {
         const domain = COMPETITOR_POOL[(start + i) % COMPETITOR_POOL.length];
         return { domain, path: `/${slug}`, href: `https://${domain}/${slug}` };
      });

      let covBase: number;
      if (status === 'covered') covBase = between(seed, 30, 72, 98);
      else if (status === 'recommended') covBase = between(seed, 30, 38, 68);
      else covBase = between(seed, 30, 8, 40);

      const dims: CoverageDim[] = DIM_LABELS.map((label, i) => ({
         label,
         value: Math.round(Math.min(99, Math.max(4, covBase + between(seed, 40 + i, -18, 18)))),
      }));

      const aiSearch = dims[2].value;
      const aiGap: AiGapItem[] = GAP_LABELS.map((label, i) => {
         const total = 3 + (hashStr(`${seed}:g${i}`) % 17);
         return {
            label,
            total,
            have: Math.min(total, Math.round(total * (aiSearch / 100) * between(seed, 60 + i, 0.5, 1.2))),
         };
      });

      const volNorm = Math.min(1, vol / 1200);
      const oppScore = Math.max(1, Math.min(99, Math.round(0.6 * (100 - dims[0].value) + 40 * volNorm)));
      let tier: Opportunity['tier'] = 'Low';
      if (oppScore >= 80) tier = 'Very High';
      else if (oppScore >= 60) tier = 'High';
      else if (oppScore >= 40) tier = 'Medium';
      const opportunity: Opportunity = {
         score: oppScore,
         tier,
         estGainClicks: Math.round(vol * between(seed, 70, 0.12, 0.5)),
         difficulty: kd < 25 ? 'Easy' : kd < 60 ? 'Medium' : 'Hard',
         priority: oppScore >= 60 ? 'High' : oppScore >= 40 ? 'Medium' : 'Low',
      };

      const subs = AUTH_LABELS.map((label, i) => ({
         label,
         value: Math.round(Math.min(99, Math.max(5, covBase + between(seed, 80 + i, -25, 20)))),
      }));
      const aiAuthority = {
         score: Math.round(subs.reduce((s, x) => s + x.value, 0) / subs.length),
         subs,
      };

      const angle = unit(seed, 90) * Math.PI * 2;
      const mag = 0.12 + 0.72 * (1 - dims[0].value / 100);
      const map = {
         x: Math.cos(angle) * mag,
         y: Math.sin(angle) * mag,
         size: 0.7 + Math.min(1.1, keywords.length * 0.2),
      };

      const fallbackStatuses: ArticleStatus[] = ['Not started', 'In progress', 'Done'];
      const articleStatus: ArticleStatus = status === 'covered'
         ? 'Covered'
         : fallbackStatuses[hashStr(`${seed}:as`) % fallbackStatuses.length];

      return {
         id: t.id ?? idx,
         name: t.title,
         mainKeyword: main,
         keywords,
         groups,
         competitors,
         kd,
         vol,
         position,
         impressions,
         covRatio: `${covered.length ? 1 : 0}/1`,
         status,
         articleStatus,
         dims,
         aiGap,
         opportunity,
         aiAuthority,
         map,
      };
   });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/topicalMap.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
cd /c/Users/patry/Desktop/serpbear
grep -q "TEMP-PROBE" pages/_app.tsx && echo "STOP: revert probe first" || true
git add lib/topicalMap.ts __tests__/lib/topicalMap.test.ts
git commit -m "feat(topical-map): deterministic data adapter for clusters/keywords/competitors" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---
### Task 2: Page rebuild — header, toolbar, two-panel "All topics" list

**Files:**
- Modify (full rewrite): `pages/sites/[domain]/topical-map.tsx`

**Interfaces:**
- Consumes: `buildTopicClusters`, `TopicCluster` from `lib/topicalMap`; `Tabs, Toggle, SearchBar, SortableHeader, Checkbox, Skeleton` from `components/ui`; `useSortState` from `lib/useSortState`; `DomainSubLayout`, `AppShell`, `useFetchDomains`, `slugToDomain`, `useSetupStatus` (all already imported by the current file).
- Produces (relied on by Tasks 3–6): page-local state names `view/setView ('topics'|'map')`, `showTitles/setShowTitles`, `query/setQuery`, `panelCluster/setPanelCluster (TopicCluster|null)`, `selected/toggleSelect (Set<number>)`, memo `shown: TopicCluster[]`; local components `StatusChip`, `KebabMenu`, `CellNum`, `HexIcon`; type `SortKey = 'kd' | 'vol' | 'position'`. Later tasks Edit-match on the exact JSX lines shown here — keep them verbatim.

- [ ] **Step 1: Read `lib/useSortState.ts` to confirm the API**

Run: `sed -n '1,40p' lib/useSortState.ts`
Expected: exports `SortDir` and a hook returning `{ sortKey, sortDir, handleSort }`. If `sortDir` can be `null`, the sort fallback below (`sortDir === 'asc' ? 1 : -1`) still works (null → desc).

- [ ] **Step 2: Rewrite the page**

Replace the ENTIRE contents of `pages/sites/[domain]/topical-map.tsx` with:

```tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { useFetchDomains } from '../../../services/domains';
import { slugToDomain } from '../../../utils/slugToDomain';
import { Tabs, Toggle, SearchBar, SortableHeader, Checkbox, Skeleton } from '../../../components/ui';
import { useSortState } from '../../../lib/useSortState';
import { buildTopicClusters, TopicCluster } from '../../../lib/topicalMap';
import { useSetupStatus } from '../../../services/domainPipeline';

const FONT = 'var(--font-family-primary)';

/* ─── Icons ─── */
const InfoIcon = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: '#9F9FA9', flexShrink: 0 }}>
      <path d="M12 16V12M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const FeedbackIcon = () => (
   <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M5.337 21.718a7 7 0 0 1-.533-.074a.75.75 0 0 1-.44-1.223a3.73 3.73 0 0 0 .814-1.686c.023-.115-.022-.317-.254-.543C3.274 16.587 2.25 14.41 2.25 12c0-5.03 4.428-9 9.75-9s9.75 3.97 9.75 9s-4.428 9-9.75 9c-.833 0-1.643-.097-2.417-.279a6.72 6.72 0 0 1-4.246.997" clipRule="evenodd" />
   </svg>
);
const ChevronDownIcon = () => (
   <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m19.5 8.25l-7.5 7.5l-7.5-7.5" />
   </svg>
);
const KebabIcon = () => (
   <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6.75 12a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m6 0a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0m6 0a.75.75 0 1 1-1.5 0a.75.75 0 0 1 1.5 0" />
   </svg>
);
export const HexIcon = ({ size = 20, color = '#783AFB' }: { size?: number; color?: string }) => (
   <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden="true" style={{ color, flexShrink: 0 }}>
      <g fill="currentColor">
         <path d="M224 80.18v95.64a8 8 0 0 1-4.16 7l-88 48.18a8 8 0 0 1-7.68 0l-88-48.18a8 8 0 0 1-4.16-7V80.18a8 8 0 0 1 4.16-7l88-48.18a8 8 0 0 1 7.68 0l88 48.18a8 8 0 0 1 4.16 7" opacity="0.2" />
         <path d="m223.68 66.15l-88-48.15a15.88 15.88 0 0 0-15.36 0l-88 48.17a16 16 0 0 0-8.32 14v95.64a16 16 0 0 0 8.32 14l88 48.17a15.88 15.88 0 0 0 15.36 0l88-48.17a16 16 0 0 0 8.32-14V80.18a16 16 0 0 0-8.32-14.03M216 175.82L128 224l-88-48.18V80.18L128 32l88 48.17Z" />
      </g>
   </svg>
);

/* ─── Small building blocks ─── */
const STATUS_META: Record<TopicCluster['status'], { label: string; dot: string; color: string }> = {
   covered: { label: 'Covered', dot: '#1AB25E', color: '#15803D' },
   recommended: { label: 'Recommended', dot: '#FF6F77', color: '#B91C1C' },
   not_covered: { label: 'Not covered', dot: '#9F9FA9', color: '#52525C' },
};
export const StatusChip = ({ status }: { status: TopicCluster['status'] }) => {
   const m = STATUS_META[status];
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: m.color, fontFamily: FONT, whiteSpace: 'nowrap' }}>
         <span style={{ width: 8, height: 8, borderRadius: 9999, background: m.dot, flexShrink: 0 }} />
         {m.label}
      </span>
   );
};

const KebabMenu = ({ items }: { items: Array<{ label: string; onClick: () => void }> }) => {
   const [open, setOpen] = useState(false);
   const ref = React.useRef<HTMLDivElement>(null);
   React.useEffect(() => {
      if (!open) return undefined;
      const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
      document.addEventListener('mousedown', h);
      return () => document.removeEventListener('mousedown', h);
   }, [open]);
   return (
      <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
         <button type="button" aria-label="More actions" onClick={() => setOpen((o) => !o)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#52525C', padding: 4, display: 'inline-flex' }}>
            <KebabIcon />
         </button>
         {open && (
            <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 150, minWidth: 180, background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: 6, boxShadow: '0px 18px 40px 0px rgba(17,24,39,0.14), 0px 8px 18px 0px rgba(17,24,39,0.09)', animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'top right' }}>
               {items.map((it) => (
                  <button
                     key={it.label}
                     type="button"
                     role="menuitem"
                     onClick={() => { setOpen(false); it.onClick(); }}
                     style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent', fontFamily: FONT, fontSize: 14, color: '#3F3F47', cursor: 'pointer' }}
                     onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                     {it.label}
                  </button>
               ))}
            </div>
         )}
      </div>
   );
};

const CellNum = ({ v, width }: { v: React.ReactNode; width: number }) => (
   <div style={{ width, flexShrink: 0, padding: '12px 16px', borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', alignSelf: 'stretch' }}>
      <span style={{ fontSize: 14, color: '#18181B', fontFamily: FONT }}>{v}</span>
   </div>
);

type SortKey = 'kd' | 'vol' | 'position';

const TopicalMapPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d: DomainType) => d.slug === slug);
   const activeDomainId: number | null = activeDomain?.ID ?? null;

   const { data: topicsData, isLoading: topicsLoading } = useQuery(
      ['domain-topics', activeDomainId],
      async () => {
         const r = await fetch(`/api/domains/${slug}/topics`);
         return r.json() as Promise<{ topics: Array<{ id: number; title: string; summary: string | null }> }>;
      },
      { enabled: !!activeDomainId, staleTime: 60_000 },
   );
   const { data: setupStatus } = useSetupStatus(slug);
   const isAnalyzing = setupStatus?.status === 'running' || setupStatus?.status === 'queued';

   const [view, setView] = useState<'topics' | 'map'>('topics');
   const [showTitles, setShowTitles] = useState(false);
   const [query, setQuery] = useState('');
   const [panelCluster, setPanelCluster] = useState<TopicCluster | null>(null);
   const [selected, setSelected] = useState<Set<number>>(new Set());
   const { sortKey, sortDir, handleSort } = useSortState<SortKey>('vol');

   const clusters = useMemo(() => buildTopicClusters(topicsData?.topics ?? []), [topicsData]);

   const shown = useMemo(() => {
      let list = clusters;
      const q = query.trim().toLowerCase();
      if (q) list = list.filter((c) => c.mainKeyword.includes(q) || c.name.toLowerCase().includes(q));
      const dir = sortDir === 'asc' ? 1 : -1;
      return [...list].sort((a, b) => (Number(a[sortKey] ?? -1) - Number(b[sortKey] ?? -1)) * dir);
   }, [clusters, query, sortKey, sortDir]);

   const toggleSelect = (id: number) => setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
   });

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head>
            <title>{`Topical Map — ${domain} — SerpBear`}</title>
         </Head>

         <DomainSubLayout domain={domain} slug={slug || ''} section="Topical Map" contentMaxWidth="100%">
            {/* ─── Title row ─── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#09090B', fontFamily: FONT }}>
                     Topical Map <span style={{ color: '#9F9FA9', fontWeight: 400 }}>{clusters.length}</span>
                  </span>
                  <InfoIcon />
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: '#3F3F47' }}>
                     <FeedbackIcon /> Leave feedback
                  </button>
                  <button
                     type="button"
                     style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 6, padding: '8px 16px', background: '#18181B', color: '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 150ms ease' }}
                     onMouseEnter={(e) => { e.currentTarget.style.background = '#783AFB'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.background = '#18181B'; }}
                  >
                     Export <ChevronDownIcon />
                  </button>
               </div>
            </div>

            {topicsLoading || (isAnalyzing && !clusters.length) ? (
               <Skeleton />
            ) : clusters.length === 0 ? (
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', gap: 20 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52525C' }}>
                     <HexIcon size={32} color="#52525C" />
                  </div>
                  <div>
                     <h2 style={{ fontSize: 20, fontWeight: 700, color: '#09090B', fontFamily: FONT, margin: '0 0 8px' }}>Topical Map</h2>
                     <p style={{ fontSize: 14, color: '#71717B', maxWidth: 420, margin: '0 auto', lineHeight: 1.6, fontFamily: FONT }}>
                        Discover topic clusters and content gaps for <strong>{domain}</strong>. Topics will appear here once the domain analysis completes.
                     </p>
                  </div>
               </div>
            ) : (
               <>
                  {/* ─── Toolbar ─── */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                     <Tabs items={[{ value: 'topics', label: 'All topics' }]} value={view} onChange={(v) => setView(v as 'topics' | 'map')} />
                     <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                           <Toggle checked={showTitles} onChange={() => setShowTitles((s) => !s)} />
                           <span style={{ fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: FONT }}>Show titles</span>
                        </label>
                        <SearchBar value={query} onChange={setQuery} placeholder="Search by main keyword" width={250} />
                     </div>
                  </div>

                  {/* ─── Two-panel list ─── */}
                  <div style={{ display: 'flex', border: '1px solid #F4F4F5', borderRadius: 8, background: '#F8F8F9', gap: 16, overflow: 'hidden', minHeight: 400 }}>
                     {/* Left: Topic cluster */}
                     <div className="styled-scrollbar" style={{ width: 330, flexShrink: 0, background: '#fff', borderRight: '1px solid #F4F4F5', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                        <div style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #F4F4F5' }}>
                           <div style={{ flex: 1, padding: '12px 16px', fontSize: 13, color: '#52525C', fontFamily: FONT }}>Topic cluster</div>
                           <div style={{ width: 50, flexShrink: 0, alignSelf: 'stretch', borderLeft: '1px solid #F4F4F5' }} />
                        </div>
                        {shown.map((c) => (
                           <div key={c.id} style={{ display: 'flex', alignItems: 'center', minHeight: 72, borderBottom: '1px solid #F4F4F5', background: panelCluster?.id === c.id ? '#F4F4F5' : 'transparent', transition: 'background 150ms ease' }}>
                              <div style={{ flex: 1, minWidth: 0, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                 <span title={c.name} style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    {([['KD', String(c.kd)], ['Vol.', String(c.vol)], ['Cov.', c.covRatio]] as Array<[string, string]>).map(([k, v]) => (
                                       <span key={k} style={{ display: 'inline-flex', gap: 4, fontSize: 12, fontFamily: FONT }}>
                                          <span style={{ fontWeight: 500, color: '#3F3F47' }}>{k}</span>
                                          <span style={{ color: '#71717B' }}>{v}</span>
                                       </span>
                                    ))}
                                 </div>
                              </div>
                              <div style={{ width: 50, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', borderLeft: '1px solid #F4F4F5', alignSelf: 'stretch' }}>
                                 <KebabMenu items={[
                                    { label: 'View details', onClick: () => setPanelCluster(c) },
                                    { label: 'Copy main keyword', onClick: () => { navigator.clipboard?.writeText(c.mainKeyword); } },
                                 ]} />
                              </div>
                           </div>
                        ))}
                     </div>

                     {/* Right: Main keyword */}
                     <div className="styled-scrollbar" style={{ flex: 1, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'stretch', background: '#fff', borderBottom: '1px solid #F4F4F5', minWidth: 760 }}>
                           <div style={{ width: 50, flexShrink: 0 }} />
                           <div style={{ flex: 1, minWidth: 300, padding: '12px 16px', display: 'flex', alignItems: 'center', borderLeft: '1px solid #F4F4F5', fontSize: 13, color: '#52525C', fontFamily: FONT }}>Main keyword</div>
                           <SortableHeader label="KD" sortKey="kd" activeKey={sortKey} dir={sortDir} width={100} onSort={(k) => handleSort(k as SortKey)} />
                           <SortableHeader label="Vol." sortKey="vol" activeKey={sortKey} dir={sortDir} width={100} onSort={(k) => handleSort(k as SortKey)} />
                           <SortableHeader label="Position" sortKey="position" activeKey={sortKey} dir={sortDir} width={100} onSort={(k) => handleSort(k as SortKey)} />
                           <div style={{ width: 50, flexShrink: 0, borderLeft: '1px solid #F4F4F5' }} />
                        </div>
                        {shown.map((c) => (
                           <div key={c.id} className="tm-row" style={{ display: 'flex', alignItems: 'center', minHeight: 72, borderBottom: '1px solid #F4F4F5', minWidth: 760, transition: 'background 150ms ease' }}>
                              <div style={{ width: 50, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                                 <Checkbox checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                              </div>
                              <div
                                 role="button"
                                 tabIndex={0}
                                 onClick={() => setPanelCluster(c)}
                                 onKeyDown={(e) => { if (e.key === 'Enter') setPanelCluster(c); }}
                                 style={{ flex: 1, minWidth: 300, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', borderLeft: '1px solid #F4F4F5', alignSelf: 'stretch' }}
                              >
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.mainKeyword}</span>
                                    <span style={{ fontSize: 13, color: '#71717B', fontFamily: FONT }}>incl. {c.keywords.length} keywords</span>
                                 </div>
                                 <StatusChip status={c.status} />
                              </div>
                              <CellNum v={c.kd} width={100} />
                              <CellNum v={c.vol} width={100} />
                              <CellNum v={c.position ?? ''} width={100} />
                              <div style={{ width: 50, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', borderLeft: '1px solid #F4F4F5', alignSelf: 'stretch' }}>
                                 <KebabMenu items={[{ label: 'View details', onClick: () => setPanelCluster(c) }]} />
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                  <style>{'.tm-row:hover { background: #F8F8F9; }'}</style>
               </>
            )}
         </DomainSubLayout>
      </AppShell>
   );
};

export default TopicalMapPage;
```

Note: `showTitles` and `view` are consumed by the Map view in Task 5; until then the toggle renders but only flips state, and the Tabs control has a single option — both intentional increments.

- [ ] **Step 3: Verify headless (probe with API interception)**

```bash
cd /c/Users/patry/Desktop/serpbear
sed -i "s#|| path.startsWith('/invite');#|| path.startsWith('/invite') || path.startsWith('/sites') /* TEMP-PROBE */;#" pages/_app.tsx
grep -q "TEMP-PROBE" pages/_app.tsx && echo "bypass applied"
(npx next dev -p 3112 > /tmp/next2.log 2>&1 &)
```

Create `__probe.js` in the repo root:

```js
const puppeteer = require('puppeteer');
const OUT = process.argv[2];
const TOPICS = { topics: [
  { id: 1, title: 'Programowanie Webowe', summary: null },
  { id: 2, title: 'Aplikacje Mobilne', summary: null },
  { id: 3, title: 'Sklepy Internetowe', summary: null },
] };
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.setRequestInterception(true);
  p.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/domains/test/topics')) {
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(TOPICS) });
    }
    if (u.includes('/api/domains')) {
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ domains: [{ ID: 1, domain: 'test.com', slug: 'test' }] }) });
    }
    return req.continue();
  });
  await p.goto('http://localhost:3112/sites/test/topical-map', { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  const t = await p.evaluate(() => document.body.innerText);
  const has = (s) => t.includes(s);
  console.log('title row:', has('Topical Map'), '| cluster:', has('Programowanie Webowe'), '| main kw:', has('programowanie webowe'), '| headers:', has('Topic cluster') && has('Main keyword') && has('Position'));
  await p.screenshot({ path: OUT + '/tm-list.png' });
  await b.close();
})();
```

Run:

```bash
until curl -s -o /dev/null --max-time 5 "http://localhost:3112/"; do sleep 3; done
node __probe.js "C:/Users/patry/AppData/Local/Temp/claude/C--Users-patry/93984127-284b-4e28-a9dd-a6a59149da31/scratchpad"
rm -f __probe.js
```

Expected console: all four checks `true`. View the screenshot (Read the PNG) — layout must show: title row with count, toolbar (All topics tab, Show titles, search), left cluster column with KD/Vol/Cov sub-stats, right table with status chips and sortable headers.

- [ ] **Step 4: Revert bypass, stop server, commit**

```bash
cd /c/Users/patry/Desktop/serpbear
sed -i "s# || path.startsWith('/sites') /\\* TEMP-PROBE \\*/;#;#" pages/_app.tsx
grep -q "TEMP-PROBE" pages/_app.tsx && echo "STOP: still present" || echo "reverted"
pkill -f "next dev -p 3112" 2>/dev/null
git add "pages/sites/[domain]/topical-map.tsx"
git commit -m "feat(topical-map): SurferSEO-style two-panel cluster/keyword list" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---
### Task 3: Filters popover

**Files:**
- Create: `components/domains/TopicalFilters.tsx`
- Modify: `pages/sites/[domain]/topical-map.tsx` (3 small edits shown below)

**Interfaces:**
- Consumes: `TopicCluster`, `ArticleStatus` from `lib/topicalMap`.
- Produces: default export `TopicalFilters` (`{ value: TopicalFilterState; onChange: (v: TopicalFilterState) => void }`), named exports `TopicalFilterState`, `DEFAULT_TOPICAL_FILTERS`, `applyTopicalFilters(list: TopicCluster[], f: TopicalFilterState): TopicCluster[]`.

- [ ] **Step 1: Create the component**

Create `components/domains/TopicalFilters.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import type { ArticleStatus, TopicCluster } from '../../lib/topicalMap';

const FONT = 'var(--font-family-primary)';

export type TopicalFilterState = {
   recommendedOnly: boolean;
   kdMin: number;
   kdMax: number;
   volMin: number;
   volMax: number;
   statuses: ArticleStatus[];
};

export const DEFAULT_TOPICAL_FILTERS: TopicalFilterState = {
   recommendedOnly: false, kdMin: 0, kdMax: 100, volMin: 0, volMax: 999999, statuses: [],
};

export const applyTopicalFilters = (list: TopicCluster[], f: TopicalFilterState): TopicCluster[] => list.filter((c) => (
   (!f.recommendedOnly || c.status === 'recommended')
   && c.kd >= f.kdMin && c.kd <= f.kdMax
   && c.vol >= f.volMin && c.vol <= f.volMax
   && (f.statuses.length === 0 || f.statuses.includes(c.articleStatus))
));

const ALL_STATUSES: ArticleStatus[] = ['Not started', 'In progress', 'Done', 'Covered'];

const FiltersIcon = () => (
   <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M17 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0zm0 13a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0zM3.75 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75M4.5 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0zM10 11a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5A.75.75 0 0 1 10 11m.75-8.25a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0zM10 6a2 2 0 1 0 0 4a2 2 0 0 0 0-4m-6.25 4a2 2 0 1 0 0 4a2 2 0 0 0 0-4m12.5 0a2 2 0 1 0 0 4a2 2 0 0 0 0-4" />
   </svg>
);
const CheckIcon = () => (
   <svg viewBox="0 0 20 20" width="16" height="16" fill="#783AFB" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" />
   </svg>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
   <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>{children}</span>
);

const NumInput = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
   <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      style={{ width: '100%', height: 38, border: '1px solid #D4D4D8', borderRadius: 10, padding: '0 10px', fontSize: 14, fontFamily: FONT, color: '#18181B', background: '#fff', boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)', outline: 'none', boxSizing: 'border-box' }}
      onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(120,58,251,0.1)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; e.currentTarget.style.boxShadow = '0px 1px 2px 0px rgba(26,29,40,0.06)'; }}
   />
);

const TopicalFilters = ({ value, onChange }: { value: TopicalFilterState; onChange: (v: TopicalFilterState) => void }) => {
   const [open, setOpen] = useState(false);
   const ref = useRef<HTMLDivElement>(null);
   useEffect(() => {
      if (!open) return undefined;
      const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
      document.addEventListener('mousedown', h);
      return () => document.removeEventListener('mousedown', h);
   }, [open]);

   const set = (patch: Partial<TopicalFilterState>) => onChange({ ...value, ...patch });
   const toggleStatus = (s: (typeof ALL_STATUSES)[number]) => set({
      statuses: value.statuses.includes(s) ? value.statuses.filter((x) => x !== s) : [...value.statuses, s],
   });

   return (
      <div ref={ref} style={{ position: 'relative' }}>
         <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: '#3F3F47', transition: 'color 150ms ease' }}
         >
            <FiltersIcon /> Filters
         </button>
         {open && (
            <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, zIndex: 150, width: 300, background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: 16, boxShadow: '0px 18px 40px 0px rgba(17,24,39,0.14), 0px 8px 18px 0px rgba(17,24,39,0.09), 0px 2px 6px 0px rgba(17,24,39,0.06)', animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'top right', display: 'flex', flexDirection: 'column', gap: 16 }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <SectionLabel>Topics</SectionLabel>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                     <span
                        role="switch"
                        aria-checked={value.recommendedOnly}
                        onClick={() => set({ recommendedOnly: !value.recommendedOnly })}
                        style={{ width: 28, height: 16, borderRadius: 9999, background: value.recommendedOnly ? '#783AFB' : '#9F9FA9', position: 'relative', cursor: 'pointer', transition: 'background 250ms', flexShrink: 0, display: 'inline-block' }}
                     >
                        <span style={{ position: 'absolute', top: 2, left: value.recommendedOnly ? 14 : 2, width: 12, height: 12, borderRadius: 9999, background: '#fff', transition: 'left 250ms' }} />
                     </span>
                     <span style={{ fontSize: 14, color: '#18181B', fontFamily: FONT }}>Recommendations only</span>
                  </label>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <SectionLabel>Difficulty</SectionLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     <NumInput value={value.kdMin} onChange={(n) => set({ kdMin: n })} />
                     <span style={{ color: '#9F9FA9' }}>-</span>
                     <NumInput value={value.kdMax} onChange={(n) => set({ kdMax: n })} />
                  </div>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <SectionLabel>Search volume</SectionLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     <NumInput value={value.volMin} onChange={(n) => set({ volMin: n })} />
                     <span style={{ color: '#9F9FA9' }}>-</span>
                     <NumInput value={value.volMax} onChange={(n) => set({ volMax: n })} />
                  </div>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <SectionLabel>Status</SectionLabel>
                  {ALL_STATUSES.map((s) => (
                     <button
                        key={s}
                        type="button"
                        onClick={() => toggleStatus(s)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 4px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15, color: '#18181B', textAlign: 'left', borderRadius: 8, transition: 'background 120ms ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                     >
                        {s}
                        {value.statuses.includes(s) && <CheckIcon />}
                     </button>
                  ))}
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <SectionLabel>Competitors</SectionLabel>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', fontSize: 15, color: '#18181B', fontFamily: FONT }}>
                     All selected
                     <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9 5l7 7l-7 7" /></svg>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default TopicalFilters;
```

- [ ] **Step 2: Wire into the page (3 edits)**

Edit 1 — add import after the `buildTopicClusters` import line:

```tsx
import TopicalFilters, { DEFAULT_TOPICAL_FILTERS, TopicalFilterState, applyTopicalFilters } from '../../../components/domains/TopicalFilters';
```

Edit 2 — add state after the `const [selected, setSelected] = ...` line:

```tsx
   const [filters, setFilters] = useState<TopicalFilterState>(DEFAULT_TOPICAL_FILTERS);
```

Edit 3 — in the `shown` memo, replace `let list = clusters;` with `let list = applyTopicalFilters(clusters, filters);` and add `filters` to the dependency array. Then insert the trigger before the SearchBar line:

```tsx
                        <TopicalFilters value={filters} onChange={setFilters} />
                        <SearchBar value={query} onChange={setQuery} placeholder="Search by main keyword" width={250} />
```

- [ ] **Step 3: Verify headless**

Same bypass/server/probe procedure as Task 2 Step 3, but extend the probe: after the initial checks, click "Filters", toggle "Recommendations only", assert the row count shrinks or stays (depending on statuses), screenshot `tm-filters.png`. Probe addition before `b.close()`:

```js
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Filters'); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 400));
  const t2 = await p.evaluate(() => document.body.innerText);
  console.log('popover:', t2.includes('Recommendations only') && t2.includes('DIFFICULTY') === false && t2.includes('Difficulty'), '| statuses:', t2.includes('Not started') && t2.includes('Covered'));
  await p.screenshot({ path: OUT + '/tm-filters.png' });
```

(Note: labels render uppercase via CSS `textTransform`, so `innerText` matching may return uppercase in Chromium — accept either by checking `t2.toLowerCase().includes('difficulty')`.)

- [ ] **Step 4: Revert bypass, stop server, commit**

```bash
cd /c/Users/patry/Desktop/serpbear
sed -i "s# || path.startsWith('/sites') /\\* TEMP-PROBE \\*/;#;#" pages/_app.tsx
grep -q "TEMP-PROBE" pages/_app.tsx && echo "STOP: still present" || echo "reverted"
pkill -f "next dev -p 3112" 2>/dev/null
git add components/domains/TopicalFilters.tsx "pages/sites/[domain]/topical-map.tsx"
git commit -m "feat(topical-map): filters popover (recommended-only, KD/volume ranges, status)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: "IDEA" detail slide-over (Keywords + Competitors)

**Files:**
- Create: `components/domains/TopicalClusterPanel.tsx`
- Modify: `pages/sites/[domain]/topical-map.tsx` (2 small edits)

**Interfaces:**
- Consumes: `TopicCluster`, `KeywordGroup` from `lib/topicalMap`; `Tabs` from `components/ui`.
- Produces: default export `TopicalClusterPanel` (`{ cluster: TopicCluster | null; onClose: () => void }`). Task 6 adds an Overview tab to THIS file.

- [ ] **Step 1: Create the component**

Create `components/domains/TopicalClusterPanel.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Tabs } from '../ui';
import type { KeywordGroup, TopicCluster } from '../../lib/topicalMap';

const FONT = 'var(--font-family-primary)';

const HexIcon = () => (
   <svg viewBox="0 0 256 256" width="20" height="20" aria-hidden="true" style={{ color: '#783AFB', flexShrink: 0 }}>
      <g fill="currentColor">
         <path d="M224 80.18v95.64a8 8 0 0 1-4.16 7l-88 48.18a8 8 0 0 1-7.68 0l-88-48.18a8 8 0 0 1-4.16-7V80.18a8 8 0 0 1 4.16-7l88-48.18a8 8 0 0 1 7.68 0l88 48.18a8 8 0 0 1 4.16 7" opacity="0.2" />
         <path d="m223.68 66.15l-88-48.15a15.88 15.88 0 0 0-15.36 0l-88 48.17a16 16 0 0 0-8.32 14v95.64a16 16 0 0 0 8.32 14l88 48.17a15.88 15.88 0 0 0 15.36 0l88-48.17a16 16 0 0 0 8.32-14V80.18a16 16 0 0 0-8.32-14.03M216 175.82L128 224l-88-48.18V80.18L128 32l88 48.17Z" />
      </g>
   </svg>
);
const XIcon = () => (
   <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" /></svg>
);
const ChevronUp = ({ open }: { open: boolean }) => (
   <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ transform: open ? 'none' : 'rotate(180deg)', transition: 'transform 200ms ease', flexShrink: 0 }}>
      <path fillRule="evenodd" d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06z" clipRule="evenodd" />
   </svg>
);

const STATUS_META: Record<TopicCluster['status'], { label: string; dot: string; color: string }> = {
   covered: { label: 'Covered', dot: '#1AB25E', color: '#15803D' },
   recommended: { label: 'Recommended', dot: '#FF6F77', color: '#B91C1C' },
   not_covered: { label: 'Not covered', dot: '#9F9FA9', color: '#52525C' },
};

const num = (v: number | null | undefined): string => (v === null || v === undefined ? '' : String(v));

const StatCell = ({ label, value }: { label: string; value: React.ReactNode }) => (
   <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px', flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{value}</span>
   </div>
);

const KW_TH: React.CSSProperties = { padding: '8px 16px', textAlign: 'right', fontSize: 13, fontWeight: 400, color: '#71717B', fontFamily: FONT, borderLeft: '1px solid #F4F4F5', textDecoration: 'underline dotted', textDecorationColor: '#9F9FA9', textUnderlineOffset: 4, whiteSpace: 'nowrap' };
const KW_TD: React.CSSProperties = { padding: '12px 16px', textAlign: 'right', fontSize: 14, color: '#18181B', fontFamily: FONT, borderLeft: '1px solid #F4F4F5' };

const GroupBlock = ({ group }: { group: KeywordGroup }) => {
   const [open, setOpen] = useState(true);
   const covered = group.keywords.filter((k) => k.covered);
   const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0);
   const meta: Array<[string, string]> = [
      [`${group.keywords.length} KEYWORD${group.keywords.length > 1 ? 'S' : ''}`, ''],
      ...(covered.length ? [['AVG. POS.', String(avg(covered.map((k) => k.position || 0)))] as [string, string]] : []),
      ['AVG. KD', String(avg(group.keywords.map((k) => k.kd)))],
      ...(covered.length ? [['TOTAL IMPR.', String(group.keywords.reduce((s, k) => s + (k.impressions || 0), 0))] as [string, string]] : []),
      ['TOTAL VOL.', String(group.keywords.reduce((s, k) => s + k.vol, 0))],
   ];
   return (
      <div style={{ border: '1px solid #F4F4F5', borderRadius: 8, overflow: 'hidden' }}>
         <div
            role="button"
            tabIndex={0}
            onClick={() => setOpen((o) => !o)}
            onKeyDown={(e) => { if (e.key === 'Enter') setOpen((o) => !o); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 12, background: '#F8F8F9', cursor: 'pointer' }}
         >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
               {group.url ? (
                  <a href={group.url} onClick={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer" style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT, textDecoration: 'none' }}>
                     {group.label} <span aria-hidden="true">↗</span>
                  </a>
               ) : (
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{group.label}</span>
               )}
               <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, fontFamily: FONT }}>
                  {meta.map(([k, v], i) => (
                     <React.Fragment key={k}>
                        {i > 0 && <span style={{ color: '#9F9FA9' }}>•</span>}
                        <span>
                           <span style={{ color: '#71717B' }}>{k}</span>
                           {v && <span style={{ color: '#18181B', marginLeft: 4 }}>{v}</span>}
                        </span>
                     </React.Fragment>
                  ))}
               </div>
            </div>
            <ChevronUp open={open} />
         </div>
         {open && (
            <div style={{ borderTop: '1px solid #F4F4F5' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                     <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                        <th style={{ ...KW_TH, textAlign: 'left', borderLeft: 'none', textDecoration: 'none', width: '100%' }}>Keywords</th>
                        <th style={KW_TH}>Position</th>
                        <th style={KW_TH}>KD</th>
                        <th style={KW_TH}>Impr.</th>
                        <th style={KW_TH}>Vol.</th>
                     </tr>
                  </thead>
                  <tbody>
                     {group.keywords.map((k) => (
                        <tr key={k.text} style={{ borderBottom: '1px solid #F4F4F5', height: 48 }}>
                           <td style={{ ...KW_TD, textAlign: 'left', borderLeft: 'none' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                 {k.text}
                                 {k.isMain && (
                                    <span style={{ background: '#3F3F47', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', fontFamily: FONT }}>main</span>
                                 )}
                              </span>
                           </td>
                           <td style={KW_TD}>{num(k.position)}</td>
                           <td style={KW_TD}>{k.kd}</td>
                           <td style={KW_TD}>{num(k.impressions)}</td>
                           <td style={KW_TD}>{k.vol}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}
      </div>
   );
};

const TopicalClusterPanel = ({ cluster, onClose }: { cluster: TopicCluster | null; onClose: () => void }) => {
   const [visible, setVisible] = useState(false);
   const [tab, setTab] = useState('keywords');

   useEffect(() => {
      if (cluster) {
         setTab('keywords');
         const t = setTimeout(() => setVisible(true), 10);
         return () => clearTimeout(t);
      }
      setVisible(false);
      return undefined;
   }, [cluster]);

   const handleClose = () => { setVisible(false); setTimeout(onClose, 220); };
   if (!cluster) return null;
   const m = STATUS_META[cluster.status];

   return (
      <>
         <div onClick={handleClose} role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.12)', opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }} />
         <div style={{ position: 'fixed', top: 8, bottom: 8, right: 8, width: 920, maxWidth: 'calc(100vw - 16px)', zIndex: 301, background: '#fff', borderRadius: 16, boxShadow: '0px 24px 64px rgba(0,0,0,0.16), 0px 8px 24px rgba(0,0,0,0.08)', border: '1px solid #E4E4E7', display: 'flex', flexDirection: 'column', overflow: 'hidden', transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 16px))', transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 16px' }}>
               <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <HexIcon />
                  <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', color: '#52525C', fontFamily: FONT }}>Idea</span>
               </span>
               <button type="button" aria-label="Close" onClick={handleClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#18181B', padding: 0, display: 'inline-flex' }}>
                  <XIcon />
               </button>
            </div>
            <div className="styled-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
               <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                     <span style={{ fontSize: 18, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{cluster.mainKeyword}</span>
                     <span style={{ fontSize: 14, color: '#18181B', fontFamily: FONT }}>includes {cluster.keywords.length} keywords</span>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: m.color, fontFamily: FONT, whiteSpace: 'nowrap', alignSelf: 'center' }}>
                     <span style={{ width: 8, height: 8, borderRadius: 9999, background: m.dot }} />
                     {m.label}
                  </span>
               </div>
               <div style={{ display: 'flex', border: '1px solid #F4F4F5', borderRadius: 8 }}>
                  <StatCell label="Avg. Position" value={num(cluster.position)} />
                  <div style={{ width: 1, background: '#F4F4F5' }} />
                  <StatCell label="KD" value={cluster.kd} />
                  <div style={{ width: 1, background: '#F4F4F5' }} />
                  <StatCell label="Total Impressions" value={cluster.impressions} />
                  <div style={{ width: 1, background: '#F4F4F5' }} />
                  <StatCell label="Vol." value={cluster.vol} />
               </div>
               <div>
                  <Tabs
                     items={[
                        { value: 'keywords', label: 'Keywords', count: cluster.keywords.length },
                        { value: 'competitors', label: 'Competitors', count: cluster.competitors.length },
                     ]}
                     value={tab}
                     onChange={setTab}
                  />
               </div>
               {tab === 'keywords' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                     {cluster.groups.map((g) => <GroupBlock key={g.label} group={g} />)}
                  </div>
               )}
               {tab === 'competitors' && (
                  <div style={{ border: '1px solid #F4F4F5', borderRadius: 8, overflow: 'hidden' }}>
                     <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                           <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 14, fontWeight: 400, color: '#18181B', fontFamily: FONT, width: 300 }}>Domain</th>
                              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 14, fontWeight: 400, color: '#18181B', fontFamily: FONT, borderLeft: '1px solid #F4F4F5' }}>URL</th>
                           </tr>
                        </thead>
                        <tbody>
                           {cluster.competitors.map((cp) => (
                              <tr key={cp.domain} style={{ borderBottom: '1px solid #F4F4F5' }}>
                                 <td style={{ padding: 12, width: 300 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                       <img alt="" width={20} height={20} style={{ borderRadius: 4, flexShrink: 0 }} src={`https://www.google.com/s2/favicons?domain=${cp.domain}&sz=32`} />
                                       <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{cp.domain}</span>
                                    </span>
                                 </td>
                                 <td style={{ padding: 12, borderLeft: '1px solid #F4F4F5', maxWidth: 430 }}>
                                    <a href={cp.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#18181B', fontFamily: FONT, textDecoration: 'none', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                       {cp.path} <span aria-hidden="true">↗</span>
                                    </a>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}
            </div>
         </div>
      </>
   );
};

export default TopicalClusterPanel;
```

- [ ] **Step 2: Wire into the page (2 edits)**

Edit 1 — add import next to the TopicalFilters import:

```tsx
import TopicalClusterPanel from '../../../components/domains/TopicalClusterPanel';
```

Edit 2 — render the panel just before `</DomainSubLayout>` (after the closing of the conditional block):

```tsx
            <TopicalClusterPanel cluster={panelCluster} onClose={() => setPanelCluster(null)} />
         </DomainSubLayout>
```

- [ ] **Step 3: Verify headless**

Same bypass/server procedure. Probe: after page load, click the first main-keyword cell, wait 600ms, assert `IDEA`, `includes`, `Keywords`, `Competitors`, `MAIN` appear; screenshot `tm-panel.png`; then click the Competitors tab button and assert a competitor domain (`akanza.pl` or `pl.wikipedia.org`) appears; screenshot `tm-competitors.png`. Probe addition:

```js
  await p.evaluate(() => { const el = [...document.querySelectorAll('[role="button"]')].find((x) => x.textContent.includes('incl.')); if (el) el.click(); });
  await new Promise((r) => setTimeout(r, 700));
  let t3 = await p.evaluate(() => document.body.innerText);
  console.log('panel:', t3.includes('IDEA') || t3.toLowerCase().includes('idea'), '| groups:', t3.includes('Not Covered'), '| main badge:', t3.toLowerCase().includes('main'));
  await p.screenshot({ path: OUT + '/tm-panel.png' });
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Competitors')); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 400));
  t3 = await p.evaluate(() => document.body.innerText);
  console.log('competitors:', t3.includes('pl.wikipedia.org') || t3.includes('akanza.pl'));
  await p.screenshot({ path: OUT + '/tm-competitors.png' });
```

- [ ] **Step 4: Revert bypass, stop server, commit**

```bash
cd /c/Users/patry/Desktop/serpbear
sed -i "s# || path.startsWith('/sites') /\\* TEMP-PROBE \\*/;#;#" pages/_app.tsx
grep -q "TEMP-PROBE" pages/_app.tsx && echo "STOP: still present" || echo "reverted"
pkill -f "next dev -p 3112" 2>/dev/null
git add components/domains/TopicalClusterPanel.tsx "pages/sites/[domain]/topical-map.tsx"
git commit -m "feat(topical-map): IDEA detail slide-over with keyword groups and competitors" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---
### Task 5: Map view — SVG radar canvas

**Note on approach:** confirmed NOT react-flow. The reference markup (a plain `<svg>` tree with `<circle>`/`<rect>`/`<path>`/`<text>` and `<g transform="...">`, no `react-flow__*` classes or node-drag handles) is a hand-rolled radar chart. Every geometry constant below (ring radii, axis rect spans, axis-label offsets, hex path `d` strings, node-fill colors) was cross-checked field-by-field against the exact reference SVG — see `lib/topicalMapGeometry.ts` comments.

**Files:**
- Create: `lib/topicalMapGeometry.ts`
- Test: `__tests__/lib/topicalMapGeometry.test.ts`
- Create: `components/domains/TopicalMapCanvas.tsx`
- Modify: `components/ui/Tabs.tsx` (widen `label` to `React.ReactNode`)
- Modify: `pages/sites/[domain]/topical-map.tsx` (3 edits)

**Interfaces:**
- Consumes: `TopicCluster` from `lib/topicalMap` (uses `map.x/y/size`, `status`, `kd`, `vol`, `covRatio`, `name`, `keywords.length`); from `lib/topicalMapGeometry`: `MAP_VIEWBOX, MAP_CENTER, MAP_AXIS_HALF_LENGTH, MAP_RING_COUNT, MAP_RING_COLORS, MAP_AXIS_STOPS (+ AxisStop type), MAP_HEX_MAIN, MAP_HEX_SATELLITE, MAP_HEX_LEGEND, MAP_SATELLITE_OFFSETS, MAP_HEX_SCALE, MAP_COVERAGE_FILL, ringRadius(i), nodeCenter(x,y)`.
- Produces: default export `TopicalMapCanvas` (`{ clusters: TopicCluster[]; showTitles: boolean }`). Selection card and zoom are internal state.

- [ ] **Step 1: Write the failing geometry test**

Create `__tests__/lib/topicalMapGeometry.test.ts`:

```ts
import { ringRadius, nodeCenter, MAP_RING_COUNT, MAP_CENTER, MAP_NODE_RANGE } from '../../lib/topicalMapGeometry';

describe('topicalMapGeometry', () => {
  it('computes ring radii stepping 44.44 up to the reference max (355.55)', () => {
    expect(ringRadius(0)).toBeCloseTo(44.44, 1);
    expect(ringRadius(MAP_RING_COUNT - 1)).toBeCloseTo(355.55, 1);
  });

  it('maps the normalized center (0,0) to the SVG center', () => {
    expect(nodeCenter(0, 0)).toEqual({ cx: MAP_CENTER.x, cy: MAP_CENTER.y });
  });

  it('scales normalized x/y by MAP_NODE_RANGE around the center', () => {
    const { cx, cy } = nodeCenter(1, -1);
    expect(cx).toBe(MAP_CENTER.x + MAP_NODE_RANGE);
    expect(cy).toBe(MAP_CENTER.y - MAP_NODE_RANGE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/topicalMapGeometry.test.ts`
Expected: FAIL — `Cannot find module '../../lib/topicalMapGeometry'`

- [ ] **Step 3: Write the geometry module**

Create `lib/topicalMapGeometry.ts`:

```ts
/**
 * Pure geometry + palette constants for the Topical Map radar canvas
 * (components/domains/TopicalMapCanvas.tsx). Every value here was
 * cross-checked field-by-field against SurferSEO's reference SVG markup:
 * ring radii step 44.44 (8 rings, r=44.44..355.55), axis rect spans
 * center±400 over an 800-unit rect, axis-label x/y offsets and their
 * `translate` adjustments, hex path `d` strings, and node fill/stroke
 * colors (e.g. rgb(99,13,227) === #630DE3 for "covered").
 */

export const MAP_VIEWBOX = { w: 1200, h: 760 };
export const MAP_CENTER = { x: MAP_VIEWBOX.w / 2, y: MAP_VIEWBOX.h / 2 };
export const MAP_AXIS_HALF_LENGTH = 400; // axis rect spans center ± 400 over an 800-long rect
export const MAP_NODE_RANGE = 340; // cluster.map.x/y ∈ [-1,1] scaled to this many SVG units
export const MAP_RING_STEP = 44.44; // radius step between the 8 concentric rings
export const MAP_RING_COUNT = 8;
export const MAP_HEX_SCALE = 1.71; // base hex scale before the per-cluster size multiplier

/** Ring stroke colors, outer→inner index 0..7 — verbatim from the reference SVG. */
export const MAP_RING_COLORS = [
   'rgb(59,113,88)', 'rgb(105,137,143)', 'rgb(151,160,199)', 'rgb(197,184,254)',
   'rgb(189,179,237)', 'rgb(182,174,220)', 'rgb(174,169,203)', 'rgb(167,164,186)',
];

export type AxisStop = { off: number; label: string; fill: string; adj: number };
/**
 * Axis tick stops. `off` is the signed distance from center along the axis;
 * `adj` is the label's `translate` shift — applied as-is on BOTH axes
 * (x-axis: `translate(${adj})`, y-axis: `translate(0 ${adj})` — no negation;
 * confirmed against the reference markup where off=-400/adj=35 renders
 * `translate(35)` on the x-axis and `translate(0 35)` on the y-axis).
 */
export const MAP_AXIS_STOPS: AxisStop[] = [
   { off: -400, label: 'Low', fill: '#52525C', adj: 35 },
   { off: -240, label: 'Medium', fill: '#8F69FC', adj: 0 },
   { off: -80, label: 'High', fill: '#169345', adj: 0 },
   { off: 80, label: 'High', fill: '#169345', adj: -25 },
   { off: 240, label: 'Medium', fill: '#8F69FC', adj: -45 },
   { off: 400, label: 'Low', fill: '#52525C', adj: -55 },
];

export const MAP_HEX_MAIN = 'M9.409,0L9.409,0L4.704,8.148L-4.704,8.148L-9.409,0L-4.704,-8.148L4.704,-8.148Z';
export const MAP_HEX_SATELLITE = 'M6.204,0L6.204,0L3.102,5.373L-3.102,5.373L-6.204,0L-3.102,-5.373L3.102,-5.373Z';
export const MAP_HEX_LEGEND = 'M7.341,0L7.341,0L3.67,6.357L-3.67,6.357L-7.341,0L-3.67,-6.357L3.67,-6.357Z';
/** Up to 3 satellite hexes cluster around the main node when a topic has >1 keyword. */
export const MAP_SATELLITE_OFFSETS: Array<[number, number]> = [[9.2, 16.2], [-14, 10], [6, -17]];

export const MAP_COVERAGE_FILL: Record<'covered' | 'not_covered' | 'recommended', { fill: string; stroke: string; strokeWidth: number }> = {
   covered: { fill: '#630DE3', stroke: '#0A0418', strokeWidth: 0.6 },
   not_covered: { fill: '#FFFFFF', stroke: '#0A0418', strokeWidth: 0.6 },
   recommended: { fill: '#FF6F77', stroke: '#A4001C', strokeWidth: 0.6 },
};

/** Ring radius for the i-th concentric ring (0-indexed, 0 = innermost). */
export const ringRadius = (i: number): number => (i + 1) * MAP_RING_STEP;

/** Absolute SVG coordinates for a cluster's node, from its normalized map.x/y ∈ [-1,1]. */
export const nodeCenter = (mapX: number, mapY: number): { cx: number; cy: number } => ({
   cx: MAP_CENTER.x + mapX * MAP_NODE_RANGE,
   cy: MAP_CENTER.y + mapY * MAP_NODE_RANGE,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/topicalMapGeometry.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Widen the Tabs label type**

In `components/ui/Tabs.tsx` change the `TabItem` interface line:

```ts
export interface TabItem { value: string; label: React.ReactNode; count?: number; }
```

(`string` is assignable to `ReactNode`, so all existing call sites keep compiling.)

- [ ] **Step 6: Create the canvas component**

Create `components/domains/TopicalMapCanvas.tsx`:

```tsx
import React, { useMemo, useRef, useState } from 'react';
import type { TopicCluster } from '../../lib/topicalMap';
import {
   MAP_VIEWBOX, MAP_CENTER, MAP_AXIS_HALF_LENGTH, MAP_RING_COUNT, MAP_RING_COLORS, MAP_AXIS_STOPS,
   MAP_HEX_MAIN, MAP_HEX_SATELLITE, MAP_HEX_LEGEND, MAP_SATELLITE_OFFSETS,
   MAP_HEX_SCALE, MAP_COVERAGE_FILL, ringRadius, nodeCenter,
} from '../../lib/topicalMapGeometry';

const FONT = 'var(--font-family-primary)';

type ColorMode = 'coverage' | 'kd';

/** rAF-throttled setter: at most one pending update per animation frame, so
 * fast pointer movement over the SVG doesn't queue a setState per pixel.
 * Pending value is boxed (`{ value: T }`) so a legitimately-queued `null`
 * (mouseleave clearing the tooltip) is distinguishable from "nothing queued". */
function useRafThrottledState<T>(initial: T): [T, (v: T) => void] {
   const [state, setState] = useState(initial);
   const pendingRef = useRef<{ value: T } | null>(null);
   const frameRef = useRef<number | null>(null);
   const set = (v: T) => {
      pendingRef.current = { value: v };
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
         frameRef.current = null;
         if (pendingRef.current) setState(pendingRef.current.value);
         pendingRef.current = null;
      });
   };
   return [state, set];
}

const ChevronDown = () => (
   <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0, color: '#18181B' }}>
      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
   </svg>
);
const CheckIcon = () => (
   <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M5 12.5l4.5 4.5L19 7" stroke="#18181B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const XIcon = () => (
   <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" /></svg>
);

const LegendHex = ({ fill, stroke }: { fill: string; stroke?: string }) => (
   <svg width="15" height="15" aria-hidden="true">
      <g transform="translate(7.5, 7.5)">
         <path d={MAP_HEX_LEGEND} transform="rotate(90)" fill={fill} stroke={stroke} strokeWidth={stroke ? 1 : 0} />
      </g>
   </svg>
);

const COLOR_MODES: Array<{ value: ColorMode; label: string }> = [
   { value: 'coverage', label: 'Cluster coverage' },
   { value: 'kd', label: 'Avg. keyword difficulty' },
];

const TopicalMapCanvas = ({ clusters, showTitles }: { clusters: TopicCluster[]; showTitles: boolean }) => {
   const [zoom, setZoom] = useState(100);
   const [mode, setMode] = useState<ColorMode>('coverage');
   const [modeOpen, setModeOpen] = useState(false);
   const [hover, setHover] = useRafThrottledState<{ c: TopicCluster; x: number; y: number } | null>(null);
   const [selected, setSelected] = useState<TopicCluster | null>(null);
   const boxRef = useRef<HTMLDivElement>(null);

   const maxKd = useMemo(() => Math.max(1, ...clusters.map((c) => c.kd)), [clusters]);
   const kdFill = (kd: number): string => {
      const t = kd / maxKd;
      if (t <= 0.34) return '#C5B8FE';
      if (t <= 0.67) return '#8F69FC';
      return '#630DE3';
   };
   const nodeStyle = (c: TopicCluster) => (mode === 'coverage'
      ? MAP_COVERAGE_FILL[c.status]
      : { fill: kdFill(c.kd), stroke: '#0A0418', strokeWidth: 0.6 });

   const onNodeMove = (c: TopicCluster) => (e: React.MouseEvent) => {
      const r = boxRef.current?.getBoundingClientRect();
      if (!r) return;
      setHover({ c, x: e.clientX - r.left, y: e.clientY - r.top });
   };

   return (
      <div ref={boxRef} style={{ position: 'relative', flex: 1, minHeight: 560, display: 'flex' }}>
         <svg viewBox={`0 0 ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.h}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', borderRadius: 8, minHeight: 560 }}>
            <defs>
               <pattern id="tm-dots" width="19" height="19" patternUnits="userSpaceOnUse">
                  <rect fill="#F4F4F5" width="100%" height="100%" />
                  <rect transform="translate(9,9)" width="1.5" height="1.5" fill="#C9C9D1" />
               </pattern>
               <linearGradient id="tm-scale-x" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#9F9FA9" />
                  <stop offset="25%" stopColor="#C5B8FE" />
                  <stop offset="50%" stopColor="#0D5920" />
                  <stop offset="75%" stopColor="#C5B8FE" />
                  <stop offset="100%" stopColor="#9F9FA9" />
               </linearGradient>
               <linearGradient id="tm-scale-y" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#9F9FA9" />
                  <stop offset="25%" stopColor="#C5B8FE" />
                  <stop offset="50%" stopColor="#0D5920" />
                  <stop offset="75%" stopColor="#C5B8FE" />
                  <stop offset="100%" stopColor="#9F9FA9" />
               </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#tm-dots)" />
            <g transform={`scale(${zoom / 100})`} style={{ transformOrigin: '50% 50%' }}>
               <g transform="rotate(-45)" style={{ transformOrigin: 'center center' }}>
                  {MAP_RING_COLORS.map((stroke, i) => (
                     <circle key={stroke} cx={MAP_CENTER.x} cy={MAP_CENTER.y} r={ringRadius(i)} fill="none" stroke={stroke} strokeWidth={0.5} />
                  ))}
                  <rect x={MAP_CENTER.x - MAP_AXIS_HALF_LENGTH} y={MAP_CENTER.y} width={MAP_AXIS_HALF_LENGTH * 2} height={0.5} fill="url(#tm-scale-x)" />
                  {MAP_AXIS_STOPS.map((s) => (
                     <text key={`x${s.off}`} x={MAP_CENTER.x + s.off} y={MAP_CENTER.y - 5} fill={s.fill} transform={`translate(${s.adj})`} style={{ fontSize: 11, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</text>
                  ))}
                  <rect x={MAP_CENTER.x} y={MAP_CENTER.y - MAP_AXIS_HALF_LENGTH} width={0.5} height={MAP_AXIS_HALF_LENGTH * 2} fill="url(#tm-scale-y)" />
                  {MAP_AXIS_STOPS.map((s) => (
                     // Same `adj`, NOT negated on this axis either — verified against the reference markup (see lib/topicalMapGeometry.ts comment).
                     <text key={`y${s.off}`} x={MAP_CENTER.x + 8} y={MAP_CENTER.y + s.off} fill={s.fill} transform={`translate(0 ${s.adj})`} style={{ fontSize: 11, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</text>
                  ))}
               </g>
               {clusters.map((c) => {
                  const st = nodeStyle(c);
                  const { cx, cy } = nodeCenter(c.map.x, c.map.y);
                  const sats = Math.min(MAP_SATELLITE_OFFSETS.length, Math.max(0, c.keywords.length - 1));
                  const dark = selected?.id === c.id;
                  const hexScale = MAP_HEX_SCALE * c.map.size;
                  return (
                     <g key={c.id} transform={`translate(${cx} ${cy})`}>
                        <g transform={`scale(${hexScale})`}>
                           <path
                              d={MAP_HEX_MAIN}
                              fill={dark ? '#2E1065' : st.fill}
                              stroke={st.stroke}
                              strokeWidth={st.strokeWidth}
                              tabIndex={0}
                              style={{ cursor: 'pointer', outline: 'none' }}
                              onClick={() => setSelected(c)}
                              onMouseMove={onNodeMove(c)}
                              onMouseLeave={() => setHover(null)}
                           />
                           {Array.from({ length: sats }, (_, i) => (
                              <g key={MAP_SATELLITE_OFFSETS[i].join(',')} transform={`translate(${MAP_SATELLITE_OFFSETS[i][0]} ${MAP_SATELLITE_OFFSETS[i][1]})`}>
                                 <path d={MAP_HEX_SATELLITE} fill={dark ? '#2E1065' : st.fill} stroke={st.stroke} strokeWidth={0.4} style={{ cursor: 'pointer' }} onClick={() => setSelected(c)} onMouseMove={onNodeMove(c)} onMouseLeave={() => setHover(null)} />
                              </g>
                           ))}
                        </g>
                        {showTitles && (
                           <text x={0} y={16 * hexScale + 16} textAnchor="middle" style={{ fontSize: 12, fontWeight: 600, fill: '#18181B', fontFamily: FONT }}>{c.name}</text>
                        )}
                     </g>
                  );
               })}
            </g>
         </svg>

         {/* Legend + selected-cluster card: one flex column stack (not two independently
             absolute-positioned boxes) so the selected card always sits right below the
             legend regardless of which legend variant (coverage swatches vs. KD gradient)
             is showing — a fixed pixel offset here previously overlapped in KD mode. */}
         <div style={{ position: 'absolute', top: 16, left: 16, width: 260, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ boxSizing: 'border-box', background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.08), 0px 4px 12px rgba(26,29,40,0.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: FONT, paddingBottom: 6 }}>Color shades by:</span>
                  <div style={{ position: 'relative' }}>
                     <button
                        type="button"
                        onClick={() => setModeOpen((o) => !o)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: 40, border: '1px solid #D4D4D8', borderRadius: 10, background: '#fff', padding: '0 12px', fontSize: 14, fontFamily: FONT, color: '#18181B', cursor: 'pointer', boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)' }}
                     >
                        {COLOR_MODES.find((mo) => mo.value === mode)!.label}
                        <span style={{ transform: modeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease', display: 'inline-flex' }}><ChevronDown /></span>
                     </button>
                     {modeOpen && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 150, background: '#fff', borderRadius: 12, padding: 6, boxShadow: '0px 18px 40px 0px rgba(17,24,39,0.14), 0px 8px 18px 0px rgba(17,24,39,0.09)', animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'top' }}>
                           {COLOR_MODES.map((mo) => (
                              <button
                                 key={mo.value}
                                 type="button"
                                 onClick={() => { setMode(mo.value); setModeOpen(false); }}
                                 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent', fontFamily: FONT, fontSize: 14, color: '#18181B', cursor: 'pointer', textAlign: 'left' }}
                                 onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
                                 onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                              >
                                 {mo.label}
                                 {mode === mo.value && <CheckIcon />}
                              </button>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
               {mode === 'coverage' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                           <LegendHex fill="#fff" stroke="#0A0418" />
                           <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>Not covered</span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                           <LegendHex fill="#630DE3" />
                           <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>Covered</span>
                        </span>
                     </div>
                     <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <LegendHex fill="#FF6F77" stroke="#A4001C" />
                        <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>Recommended</span>
                     </span>
                  </div>
               ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                     <div style={{ height: 8, borderRadius: 9999, background: 'linear-gradient(90deg, #C5B8FE 0%, #8F69FC 50%, #630DE3 100%)' }} />
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>
                        <span>Low KD</span>
                        <span>High KD</span>
                     </div>
                  </div>
               )}
            </div>

            {selected && (
               <div style={{ boxSizing: 'border-box', background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.08), 0px 4px 12px rgba(26,29,40,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9F9FA9', fontFamily: FONT }}>Topic cluster</span>
                     <button type="button" aria-label="Close cluster card" onClick={() => setSelected(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#18181B', padding: 0, display: 'inline-flex' }}>
                        <XIcon />
                     </button>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#18181B', fontFamily: FONT }}>{selected.name}</span>
                  <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#71717B', fontFamily: FONT }}>
                     <span>KD: <span style={{ color: '#3F3F47' }}>{selected.kd}</span></span>
                     <span>SV: <span style={{ color: '#3F3F47' }}>{selected.vol}</span></span>
                     <span>Covg.: <span style={{ color: '#3F3F47' }}>{selected.covRatio}</span></span>
                  </div>
                  <svg width="120" height="120" viewBox="-12 -12 24 24" style={{ margin: '12px auto 4px' }} aria-hidden="true">
                     <path d={MAP_HEX_MAIN} fill={nodeStyle(selected).fill} stroke={nodeStyle(selected).stroke} strokeWidth={0.8} />
                  </svg>
               </div>
            )}
         </div>

         {/* Zoom card */}
         <div style={{ position: 'absolute', top: 16, right: 16, background: '#fff', borderRadius: 8, padding: '10px 8px', boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.08), 0px 4px 12px rgba(26,29,40,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" aria-label="Decrease zoom" disabled={zoom <= 100} onClick={() => setZoom((z) => Math.max(100, z - 25))} style={{ border: 'none', background: 'transparent', cursor: zoom <= 100 ? 'not-allowed' : 'pointer', opacity: zoom <= 100 ? 0.5 : 1, color: '#3F3F47', display: 'inline-flex', padding: 2 }}>
               <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M4.25 12a.75.75 0 0 1 .75-.75h14a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75" clipRule="evenodd" /></svg>
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#3F3F47', fontFamily: FONT, minWidth: 42, textAlign: 'center' }}>{zoom}%</span>
            <button type="button" aria-label="Increase zoom" disabled={zoom >= 200} onClick={() => setZoom((z) => Math.min(200, z + 25))} style={{ border: 'none', background: 'transparent', cursor: zoom >= 200 ? 'not-allowed' : 'pointer', opacity: zoom >= 200 ? 0.5 : 1, color: '#3F3F47', display: 'inline-flex', padding: 2 }}>
               <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75" clipRule="evenodd" /></svg>
            </button>
         </div>

         {/* Hover tooltip */}
         {hover && (
            <div style={{ position: 'absolute', left: hover.x, top: hover.y - 64, transform: 'translateX(-50%)', background: '#18181B', color: '#fff', borderRadius: 8, padding: '8px 12px', pointerEvents: 'none', fontFamily: FONT, whiteSpace: 'nowrap', zIndex: 150 }}>
               <div style={{ fontSize: 14, fontWeight: 700 }}>{hover.c.name}</div>
               <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#D4D4D8', marginTop: 2 }}>
                  <span>KD: <span style={{ color: '#fff' }}>{hover.c.kd}</span></span>
                  <span>SV: <span style={{ color: '#fff' }}>{hover.c.vol}</span></span>
                  <span>Covg.: <span style={{ color: '#fff' }}>{hover.c.covRatio}</span></span>
               </div>
            </div>
         )}
      </div>
   );
};

export default TopicalMapCanvas;
```

- [ ] **Step 7: Wire into the page (3 edits)**

Edit 1 — add import next to TopicalClusterPanel's:

```tsx
import TopicalMapCanvas from '../../../components/domains/TopicalMapCanvas';
```

Edit 2 — replace the single-item Tabs line with the two-view control:

```tsx
                     <Tabs
                        items={[
                           { value: 'topics', label: 'All topics' },
                           { value: 'map', label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><HexIcon size={18} />Map</span>) },
                        ]}
                        value={view}
                        onChange={(v) => setView(v as 'topics' | 'map')}
                     />
```

Edit 3 — wrap the two-panel list in the view conditional. Replace the opening line `{/* ─── Two-panel list ─── */}` block wrapper: put `{view === 'map' ? (<TopicalMapCanvas clusters={shown} showTitles={showTitles} />) : (` immediately before the two-panel `<div style={{ display: 'flex', border: '1px solid #F4F4F5' ...` and close with `)}` right after that div's closing tag (before the `<style>` line). The `<style>` hover rule stays outside the conditional.

- [ ] **Step 8: Verify headless**

Same bypass/server procedure. Probe additions: click the "Map" tab, wait 600ms, evaluate `document.querySelectorAll('svg circle').length >= 8`, hex node paths `document.querySelectorAll('svg path[d^="M9.409"]').length >= 3`, body text contains `Color shades by:` and `100%`. Do NOT click hex nodes in the probe (coordinates inside a scaled SVG are viewport-dependent — verify node selection manually from the screenshot instead). Screenshot `tm-map.png`.

```js
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().endsWith('Map')); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 700));
  const mapInfo = await p.evaluate(() => ({
    rings: document.querySelectorAll('svg circle').length,
    hexes: document.querySelectorAll('svg path[d^="M9.409"]').length,
    legend: document.body.innerText.includes('Color shades by:'),
    zoom: document.body.innerText.includes('100%'),
  }));
  console.log('map:', JSON.stringify(mapInfo));
  await p.screenshot({ path: OUT + '/tm-map.png' });
```

Expected: `rings >= 8`, `hexes >= 3`, `legend: true`, `zoom: true`. View the screenshot: dotted background, 8 rings, two diagonal gradient axes with Low/Medium/High labels, purple hexes, legend + zoom cards.

- [ ] **Step 9: Revert bypass, stop server, commit**

```bash
cd /c/Users/patry/Desktop/serpbear
sed -i "s# || path.startsWith('/sites') /\\* TEMP-PROBE \\*/;#;#" pages/_app.tsx
grep -q "TEMP-PROBE" pages/_app.tsx && echo "STOP: still present" || echo "reverted"
pkill -f "next dev -p 3112" 2>/dev/null
git add lib/topicalMapGeometry.ts __tests__/lib/topicalMapGeometry.test.ts components/domains/TopicalMapCanvas.tsx components/ui/Tabs.tsx "pages/sites/[domain]/topical-map.tsx"
git commit -m "feat(topical-map): SVG radar map view with legend, zoom and cluster card" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---
### Task 6: Extensions — Overview tab (coverage dims, Opportunity, AI Authority, AI Gap) + Opportunity column

**Files:**
- Modify: `components/domains/TopicalClusterPanel.tsx`
- Modify: `pages/sites/[domain]/topical-map.tsx` (Opp. column)

**Interfaces:**
- Consumes: `TopicCluster.dims`, `.opportunity`, `.aiAuthority`, `.aiGap` (all produced by Task 1 — no lib changes needed).
- Produces: panel default tab becomes `'overview'`; page `SortKey` union gains `'opportunity'`.

- [ ] **Step 1: Add Overview building blocks to the panel**

In `components/domains/TopicalClusterPanel.tsx`, insert after the `StatCell` component:

```tsx
const barColor = (v: number): string => (v >= 80 ? '#1AB25E' : v >= 50 ? '#8B73F6' : '#FF6F77');

const BarRow = ({ label, value }: { label: string; value: number }) => (
   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 110, fontSize: 13, color: '#3F3F47', fontFamily: FONT, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 9999, background: '#F4F4F5', overflow: 'hidden' }}>
         <div style={{ width: `${value}%`, height: '100%', borderRadius: 9999, background: barColor(value), transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ width: 40, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{value}%</span>
   </div>
);

const OverviewSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
   <section style={{ border: '1px solid #F4F4F5', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>{title}</h3>
      {children}
   </section>
);

const TIER_COLORS: Record<string, { bg: string; color: string }> = {
   'Very High': { bg: '#F0FDF4', color: '#15803D' },
   High: { bg: 'rgba(120,58,251,0.08)', color: '#783AFB' },
   Medium: { bg: '#FEF3C7', color: '#B45309' },
   Low: { bg: '#F4F4F5', color: '#52525C' },
};

const OverviewTab = ({ cluster }: { cluster: TopicCluster }) => {
   const { opportunity: opp, dims, aiAuthority, aiGap } = cluster;
   const tier = TIER_COLORS[opp.tier];
   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
         <OverviewSection title="Opportunity">
            <div style={{ display: 'flex', border: '1px solid #F4F4F5', borderRadius: 8 }}>
               <StatCell label="Opportunity" value={(
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                     {opp.score}
                     <span style={{ background: tier.bg, color: tier.color, borderRadius: 9999, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{opp.tier}</span>
                  </span>
               )} />
               <div style={{ width: 1, background: '#F4F4F5' }} />
               <StatCell label="Estimated gain" value={`+${opp.estGainClicks} clicks/mo`} />
               <div style={{ width: 1, background: '#F4F4F5' }} />
               <StatCell label="Difficulty" value={opp.difficulty} />
               <div style={{ width: 1, background: '#F4F4F5' }} />
               <StatCell label="Priority" value={opp.priority} />
            </div>
         </OverviewSection>
         <OverviewSection title="Topic health">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
               {dims.map((d) => <BarRow key={d.label} label={d.label} value={d.value} />)}
            </div>
         </OverviewSection>
         <OverviewSection title="AI Authority">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
               <span style={{ fontSize: 24, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{aiAuthority.score}%</span>
               <span style={{ fontSize: 13, color: '#71717B', fontFamily: FONT }}>overall</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
               {aiAuthority.subs.map((s) => <BarRow key={s.label} label={s.label} value={s.value} />)}
            </div>
         </OverviewSection>
         <OverviewSection title="AI Gap">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
               {aiGap.map((g) => {
                  const pct = Math.round((g.have / g.total) * 100);
                  return (
                     <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: FONT }}>
                           <span style={{ color: '#3F3F47' }}>{g.label}</span>
                           <span style={{ fontWeight: 600, color: '#18181B' }}>{g.have}/{g.total}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 9999, background: '#F4F4F5', overflow: 'hidden' }}>
                           <div style={{ width: `${pct}%`, height: '100%', borderRadius: 9999, background: barColor(pct) }} />
                        </div>
                     </div>
                  );
               })}
            </div>
         </OverviewSection>
      </div>
   );
};
```

- [ ] **Step 2: Wire the Overview tab**

Still in `TopicalClusterPanel.tsx`:
1. Change `const [tab, setTab] = useState('keywords');` → `useState('overview');` and in the reset effect `setTab('keywords')` → `setTab('overview')`.
2. Extend the Tabs items array so it starts with `{ value: 'overview', label: 'Overview' },`.
3. Add the render branch above the keywords branch:

```tsx
               {tab === 'overview' && <OverviewTab cluster={cluster} />}
```

- [ ] **Step 3: Add the Opportunity column to the list**

In `pages/sites/[domain]/topical-map.tsx`:
1. `type SortKey = 'kd' | 'vol' | 'position' | 'opportunity';`
2. In the `shown` memo, replace the sort comparator body with:

```tsx
      const val = (c: TopicCluster): number => (sortKey === 'opportunity' ? c.opportunity.score : Number(c[sortKey] ?? -1));
      return [...list].sort((a, b) => (val(a) - val(b)) * dir);
```

3. Insert a header between the Position header and the trailing 50px kebab header cell:

```tsx
                           <SortableHeader label="Opp." sortKey="opportunity" activeKey={sortKey} dir={sortDir} width={90} onSort={(k) => handleSort(k as SortKey)} />
```

4. Insert the matching row cell between `<CellNum v={c.position ?? ''} width={100} />` and the kebab cell:

```tsx
                              <div style={{ width: 90, flexShrink: 0, padding: '12px 16px', borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', alignSelf: 'stretch' }}>
                                 <span style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, borderRadius: 9999, padding: '2px 8px', background: c.opportunity.score >= 60 ? 'rgba(120,58,251,0.08)' : '#F4F4F5', color: c.opportunity.score >= 60 ? '#783AFB' : '#52525C' }}>{c.opportunity.score}</span>
                              </div>
```

5. Bump both header-row and data-row `minWidth: 760` → `minWidth: 850`.

- [ ] **Step 4: Run lib tests still green + verify headless**

Run: `npx jest __tests__/lib/topicalMap.test.ts` → PASS.
Headless (same procedure): open panel → assert `Overview`, `Topic health`, `AI Authority`, `AI Gap`, `Estimated gain` in body text; screenshot `tm-overview.png`; back on the list assert the `Opp.` header exists and clicking it re-sorts (first row changes or stays deterministically). Screenshot `tm-opp.png`.

- [ ] **Step 5: Revert bypass, stop server, commit**

```bash
cd /c/Users/patry/Desktop/serpbear
sed -i "s# || path.startsWith('/sites') /\\* TEMP-PROBE \\*/;#;#" pages/_app.tsx
grep -q "TEMP-PROBE" pages/_app.tsx && echo "STOP: still present" || echo "reverted"
pkill -f "next dev -p 3112" 2>/dev/null
git add components/domains/TopicalClusterPanel.tsx "pages/sites/[domain]/topical-map.tsx"
git commit -m "feat(topical-map): Overview insights (health, opportunity, AI authority/gap) + Opp column" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Final sweep

**Files:** none new — verification + hygiene only.

- [ ] **Step 1: Full test run**

Run: `cd /c/Users/patry/Desktop/serpbear && npx jest __tests__/lib/topicalMap.test.ts && npx jest 2>&1 | tail -5`
Expected: topicalMap suite PASS; full run introduces no NEW failures vs. `git stash`-free baseline (pre-existing failures, if any, are out of scope — compare by running `npx jest` on main first if unsure).

- [ ] **Step 2: Full headless sweep**

One probe run covering: list renders 3 fake clusters → filters popover opens → panel opens (Overview default, Keywords groups, Competitors table) → Map tab renders rings/hexes/legend/zoom → Show titles shows names on the map. Take screenshots `tm-final-{list,panel,map}.png` and Read each to confirm visually against the SurferSEO references.

- [ ] **Step 3: Hygiene checks**

```bash
cd /c/Users/patry/Desktop/serpbear
grep -rn "TEMP-PROBE" pages/ && echo "STOP" || echo "clean"
grep -rn "Math.random\|Date.now" lib/topicalMap.ts components/domains/TopicalMapCanvas.tsx components/domains/TopicalClusterPanel.tsx components/domains/TopicalFilters.tsx && echo "STOP: nondeterminism" || echo "clean"
git status --short
```

Expected: both `clean`, working tree has no stray files (`__probe.js` deleted).

- [ ] **Step 4: Final commit (only if hygiene fixes were needed)**

```bash
git add -A && git commit -m "chore(topical-map): final verification sweep" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** 1:1 list (Task 2), filters (Task 3), IDEA panel with Keywords/Competitors (Task 4), Map radar with legend/zoom/tooltip/cluster-card/show-titles/color-modes (Task 5), extensions Overview/Opportunity/AI Authority/AI Gap + Opp sort (Task 6). Out of scope by explicit decision: Competitor heatmap overlay, Content Roadmap, History timeline, real-engine wiring (future plan).
- **Type consistency:** `TopicCluster` fields referenced in Tasks 2–6 (`mainKeyword, keywords, groups, competitors, kd, vol, position, impressions, covRatio, status, articleStatus, dims, aiGap, opportunity, aiAuthority, map`) all exist in Task 1's type. Panel props `{cluster, onClose}`; canvas props `{clusters, showTitles}`; filters `{value, onChange}` — used consistently.
- **Known judgment calls:** `slugify` uses a literal combining-diacritics character class (source file must stay UTF-8); `useSortState` API is confirmed in Task 2 Step 1 before use; probe text assertions tolerate CSS-uppercased labels.
- **2026-07-02 external review pass (Task 5 only):** cross-checked Task 5 against the exact SurferSEO map SVG the user pasted, field-by-field (ring radii/colors, axis rect spans, axis-label `translate` offsets, hex path `d` strings, node fill colors). Found and fixed a real sign bug: the y-axis label `transform` was negating `s.adj`; the reference markup applies `s.adj` unnegated on both axes. Applied the review's low-risk, verified suggestions scoped to Task 5: extracted geometry/palette constants to `lib/topicalMapGeometry.ts` (testable, single source of truth, removes the "magic numbers" complaint) and rAF-throttled the hover tooltip's `setState` (removes the "unbounded mousemove re-render" complaint); restacked the legend + selected-cluster cards into one flex column instead of two absolutely-positioned boxes with a hardcoded `top:196`, which also fixed a real overlap bug in KD color mode. Declined the review's broader suggestions as premature for this codebase/data scale: `React.memo`/`useCallback` blanket coverage, `useMap`/`useTooltip`/`useZoom` hook extraction, splitting the canvas/panel into multiple files (no reuse pressure; `SlidePanel.tsx` is a comparable single-file precedent), virtualization/lazy-loading/Suspense/Error-Boundary (data volume is realistically tens of topics, not thousands), and splitting Task 1's adapter into 5 files or introducing per-component ViewModels (out of scope for the map-canvas ask; would need its own plan if requested).




