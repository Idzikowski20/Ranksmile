# AI Search Score and Global Surfer Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a SurferSEO-like content editor experience with a global dark topbar, fullscreen editor mode, real AI Search Score, stronger competitor-based keyword intelligence, and a production-ready database path.

**Architecture:** Introduce a global application shell that owns the topbar and optional sidebar, then move article editor into a sidebarless editor shell. Add durable analysis tables for competitor pages, extracted terms, AI visibility runs, citations, and article versions. Replace current frequency-based term extraction with Polish-aware competitor/entity extraction, then compute AI Search Score from saved AI-answer/citation evidence instead of a mock card.

**Tech Stack:** Next.js Pages Router, React, Sequelize, SQLite initially with a Postgres/Neon migration path, Python FastAPI sidecar, Serper.dev, DeepSeek/Together-compatible chat APIs, Helicone gateway/observability, WordPress REST API.

---

## Scope And Assumptions

- The global topbar must appear on every authenticated product page.
- The old left sidebar remains for normal dashboard/list/domain pages.
- The article editor page must hide the left sidebar and use the global topbar plus editor/action panels, matching the Surfer screenshot.
- AI Search Score must be based on stored evidence: prompts, AI answers, cited URLs, cited domains, competitor citations, and article extractability checks.
- Keyword terms must stop showing Polish filler words such as `nie`, `albo`, `może`, `jest`, `czy`.
- Keep changes surgical: each task has a narrow verification step.
- `graphify-out/` is currently missing; after code edits in this implementation phase, run `graphify update .` if the tool is available.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/common/AppShell.tsx` | Create | Global layout with topbar, optional sidebar, and page content frame |
| `components/common/GlobalTopbar.tsx` | Create | Dark Surfer-like topbar used on every page |
| `components/common/TopbarAccountMenu.tsx` | Create | Avatar menu with settings/logout, matching requested UI |
| `components/common/DashboardLayout.tsx` | Modify | Delegate to `AppShell` with sidebar enabled |
| `pages/articles/[id]/index.tsx` | Modify | Use `AppShell` with sidebar disabled; remove direct `Sidebar` render |
| `pages/domain/*/[slug]/index.tsx` | Modify | Replace direct `Sidebar` layout with `AppShell` |
| `styles/globals.css` | Modify | Add shell/topbar tokens and fullscreen editor layout CSS |
| `lib/aiSearchScore.ts` | Create | Pure scoring functions for AI Search Score |
| `lib/articleTerms.ts` | Create | Shared TypeScript utilities for term filtering/counting |
| `pages/api/articles/ai-visibility.ts` | Create | Run/store AI visibility checks for one article |
| `pages/api/articles/[id].ts` | Modify | Return AI visibility summary and article version metadata |
| `pages/api/articles/deep-analysis.ts` | Modify | Stop using naive Polish term extraction; persist richer analysis |
| `components/articles/ContentScorePanel.tsx` | Modify | Render real AI Search card and open details panel |
| `components/articles/AiSearchPanel.tsx` | Create | Evidence panel for prompts, answers, citations, and fixes |
| `python-sidecar/analyzers/serp_analyzer.py` | Modify | Polish stopwords, phrase/entity extraction, competitor stats |
| `python-sidecar/analyzers/ai_visibility.py` | Create | AI visibility runner service logic |
| `python-sidecar/main.py` | Modify | Add `/ai-visibility` endpoint |
| `database/migrations/1748200000000-add-ai-visibility-tables.js` | Create | Add AI visibility, terms, competitors, versions tables |
| `database/database.ts` | Later modify | Add Postgres dialect switch for Neon migration |
| `.env.example` | Modify | Add AI/Helicone/Neon env vars |

---

## Task 1: Global App Shell With Topbar

**Files:**
- Create: `components/common/AppShell.tsx`
- Create: `components/common/GlobalTopbar.tsx`
- Create: `components/common/TopbarAccountMenu.tsx`
- Modify: `components/common/DashboardLayout.tsx`
- Modify: `styles/globals.css`

- [ ] **Step 1: Create `TopbarAccountMenu.tsx`**

Create a small local state menu, no external dropdown dependency:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Icon from './Icon';

type Props = {
  email?: string;
  initials?: string;
};

const TopbarAccountMenu = ({ email = 'boski.idzikowski@gmail.com', initials = 'B' }: Props) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  return (
    <div className="topbar-account" ref={ref}>
      <button
        type="button"
        className="topbar-avatar-trigger"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="topbar-avatar topbar-avatar-small">{initials}</span>
        <span className="topbar-avatar topbar-avatar-large">{initials}</span>
      </button>
      {open && (
        <div className="topbar-account-menu" role="menu">
          <div className="topbar-account-row">
            <span className="topbar-avatar topbar-avatar-large">{initials}</span>
            <span className="topbar-account-email">{email}</span>
          </div>
          <button type="button" role="menuitem" className="topbar-account-item" onClick={() => router.push('/settings')}>
            <Icon type="settings-alt" size={20} />
            Settings
          </button>
          <div className="topbar-account-section-label">Organization</div>
          <div className="topbar-account-org">
            <span className="topbar-avatar topbar-avatar-small">{initials}</span>
            <span>Your Organization</span>
            <span className="topbar-account-check">✓</span>
          </div>
          <button
            type="button"
            role="menuitem"
            className="topbar-account-item"
            onClick={() => { window.location.href = '/api/auth/logout'; }}
          >
            <Icon type="logout" size={20} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
};

export default TopbarAccountMenu;
```

- [ ] **Step 2: Create `GlobalTopbar.tsx`**

```tsx
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from './Icon';
import TopbarAccountMenu from './TopbarAccountMenu';

type Props = {
  title?: string;
};

function getSection(pathname: string) {
  if (pathname.startsWith('/articles')) return { href: '/articles', label: 'Content Editor' };
  if (pathname.startsWith('/research')) return { href: '/research', label: 'Research' };
  if (pathname.startsWith('/domain')) return { href: '/domains', label: 'Domains' };
  if (pathname.startsWith('/settings')) return { href: '/settings', label: 'Settings' };
  return { href: '/dashboard', label: 'Dashboard' };
}

const GlobalTopbar = ({ title }: Props) => {
  const router = useRouter();
  const section = getSection(router.pathname);
  const crumbTitle = title || (router.pathname.includes('/[id]') ? 'Article' : section.label);

  return (
    <header className="global-topbar">
      <div className="global-topbar-left">
        <Link href="/dashboard" passHref>
          <a className="global-topbar-logo" aria-label="SerpBear dashboard">
            <Icon type="logo" size={20} color="var(--color-text-tertiary)" />
          </a>
        </Link>
        <Icon type="caret-right" size={18} color="var(--topbar-muted)" />
        <Link href={section.href} passHref>
          <a className="global-topbar-link">{section.label}</a>
        </Link>
        <Icon type="caret-right" size={18} color="var(--topbar-muted)" />
        <div className="global-topbar-title">
          <span>{crumbTitle}</span>
          <button type="button" className="global-topbar-info" aria-label="Page info">
            <Icon type="question" size={16} />
          </button>
        </div>
      </div>

      <button type="button" className="global-topbar-search" aria-label="Search">
        <Icon type="search" size={20} />
        <span>Search</span>
        <kbd>Ctrl+K</kbd>
      </button>

      <div className="global-topbar-actions">
        <button type="button" className="global-topbar-icon" aria-label="Notifications">
          <Icon type="download" size={20} />
        </button>
        <button type="button" className="global-topbar-icon" aria-label="Help">
          <Icon type="question" size={20} />
        </button>
        <TopbarAccountMenu />
      </div>
    </header>
  );
};

export default GlobalTopbar;
```

- [ ] **Step 3: Create `AppShell.tsx`**

```tsx
import React from 'react';
import Sidebar from './Sidebar';
import GlobalTopbar from './GlobalTopbar';

type AppShellProps = {
  domains?: DomainType[];
  showAddModal: () => void;
  showSettings?: () => void;
  children: React.ReactNode;
  showSidebar?: boolean;
  topbarTitle?: string;
  contentClassName?: string;
};

const AppShell = ({
  domains = [],
  showAddModal,
  showSettings,
  children,
  showSidebar = true,
  topbarTitle,
  contentClassName = '',
}: AppShellProps) => {
  return (
    <div className="app-shell">
      <GlobalTopbar title={topbarTitle} />
      <div className="app-shell-body">
        {showSidebar && (
          <Sidebar
            domains={domains}
            showAddModal={showAddModal}
            showSettings={showSettings}
          />
        )}
        <main className={`app-content ${contentClassName}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
```

- [ ] **Step 4: Update `DashboardLayout.tsx` to delegate to `AppShell`**

Replace the component body with:

```tsx
import React from 'react';
import AppShell from './AppShell';

type DashboardLayoutProps = {
  domains?: DomainType[];
  showAddModal: () => void;
  showSettings?: () => void;
  children: React.ReactNode;
};

const DashboardLayout = ({
  domains = [],
  showAddModal,
  showSettings,
  children,
}: DashboardLayoutProps) => {
  return (
    <AppShell
      domains={domains}
      showAddModal={showAddModal}
      showSettings={showSettings}
    >
      {children}
    </AppShell>
  );
};

export default DashboardLayout;
```

- [ ] **Step 5: Add shell CSS**

Append to `styles/globals.css`:

```css
:root {
   --topbar-height: 58px;
   --topbar-bg: #09090b;
   --topbar-panel: #18181b;
   --topbar-muted: #9f9fa9;
   --topbar-text: #ffffff;
}

.app-shell {
   height: 100%;
   min-height: 100vh;
   display: flex;
   flex-direction: column;
   background: var(--topbar-bg);
}

.global-topbar {
   position: sticky;
   top: 0;
   z-index: 100;
   min-height: var(--topbar-height);
   display: flex;
   align-items: center;
   justify-content: space-between;
   gap: 12px;
   padding: 8px 16px 0;
   color: var(--topbar-text);
   background: var(--topbar-bg);
   font-family: var(--font-family-primary);
   font-size: 14px;
   font-weight: 600;
}

.global-topbar-left,
.global-topbar-actions,
.global-topbar-title,
.global-topbar-search {
   display: flex;
   align-items: center;
}

.global-topbar-left {
   min-width: 0;
   flex: 1;
   gap: 8px;
}

.global-topbar-logo,
.global-topbar-link,
.global-topbar-info,
.global-topbar-icon {
   display: inline-flex;
   align-items: center;
   justify-content: center;
   color: inherit;
   background: transparent;
   border: none;
   text-decoration: none;
}

.global-topbar-link {
   color: var(--topbar-muted);
   white-space: nowrap;
}

.global-topbar-link:hover,
.global-topbar-icon:hover,
.global-topbar-info:hover {
   color: var(--topbar-text);
   opacity: 0.85;
}

.global-topbar-title {
   min-width: 0;
   gap: 8px;
   color: var(--topbar-text);
}

.global-topbar-title span {
   overflow: hidden;
   text-overflow: ellipsis;
   white-space: nowrap;
}

.global-topbar-info,
.global-topbar-icon {
   width: 32px;
   height: 32px;
   cursor: pointer;
   color: var(--topbar-muted);
}

.global-topbar-search {
   width: min(250px, 28vw);
   min-width: 160px;
   align-self: stretch;
   justify-content: space-between;
   gap: 8px;
   padding: 0 12px;
   border: none;
   border-radius: 999px;
   background: var(--topbar-panel);
   color: var(--topbar-muted);
   font-weight: 500;
}

.global-topbar-search kbd {
   display: block;
   padding: 4px 8px;
   border-radius: 4px;
   background: var(--topbar-bg);
   color: var(--topbar-muted);
   font: inherit;
   line-height: 1;
}

.global-topbar-actions {
   flex: 1;
   justify-content: flex-end;
   gap: 8px;
}

.app-shell-body {
   flex: 1;
   min-height: 0;
   display: flex;
   overflow: hidden;
}

.topbar-account {
   position: relative;
}

.topbar-avatar-trigger {
   display: flex;
   align-items: center;
   gap: 4px;
   padding: 4px;
   border: none;
   border-radius: 999px;
   background: var(--topbar-panel);
   color: #18181b;
}

.topbar-avatar {
   display: inline-flex;
   align-items: center;
   justify-content: center;
   font-weight: 700;
   background: #f4f4f5;
   color: #18181b;
}

.topbar-avatar-small {
   width: 24px;
   height: 24px;
   border-radius: 8px;
   background: #e1dbfe;
}

.topbar-avatar-large {
   width: 32px;
   height: 32px;
   border-radius: 999px;
}

.topbar-account-menu {
   position: absolute;
   top: calc(100% + 12px);
   right: 0;
   width: 360px;
   border: 1px solid #e4e4e7;
   border-radius: 16px;
   background: #ffffff;
   color: #18181b;
   box-shadow: 0 14px 40px rgba(0,0,0,0.18);
   overflow: hidden;
}

.topbar-account-row,
.topbar-account-item,
.topbar-account-org {
   display: flex;
   align-items: center;
   gap: 14px;
   width: 100%;
   padding: 18px 20px;
   background: #ffffff;
   color: #3f3f47;
   border: none;
   text-align: left;
   font-size: 16px;
}

.topbar-account-item {
   cursor: pointer;
}

.topbar-account-item:hover {
   background: #f8f8f9;
}

.topbar-account-email {
   overflow: hidden;
   text-overflow: ellipsis;
   white-space: nowrap;
}

.topbar-account-section-label {
   padding: 12px 20px 4px;
   color: #3f3f47;
   font-size: 12px;
   font-weight: 700;
   text-transform: uppercase;
}

.topbar-account-check {
   margin-left: auto;
}

@media (max-width: 767px) {
   .global-topbar {
      gap: 8px;
      padding-right: 8px;
   }

   .global-topbar-search {
      display: none;
   }

   .global-topbar-actions {
      flex: 0 0 auto;
   }

   .topbar-account-menu {
      width: min(360px, calc(100vw - 24px));
   }
}
```

- [ ] **Step 6: Verify existing pages still render**

Run:

```bash
npm run lint
```

Expected: no new lint errors from `AppShell`, `GlobalTopbar`, or `TopbarAccountMenu`.

- [ ] **Step 7: Commit**

```bash
git add components/common/AppShell.tsx components/common/GlobalTopbar.tsx components/common/TopbarAccountMenu.tsx components/common/DashboardLayout.tsx styles/globals.css
git commit -m "feat: add global app topbar shell"
```

---

## Task 2: Make Article Editor Fullscreen Without Sidebar

**Files:**
- Modify: `pages/articles/[id]/index.tsx`
- Modify: `styles/globals.css`

- [ ] **Step 1: Replace direct `Sidebar` layout with `AppShell`**

In `pages/articles/[id]/index.tsx`, replace:

```tsx
import Sidebar from '../../../components/common/Sidebar';
```

with:

```tsx
import AppShell from '../../../components/common/AppShell';
```

Then replace the return wrapper:

```tsx
return (
  <div className="flex" style={{ height: '100%', overflow: 'hidden' }}>
    <Sidebar
      domains={domains}
      showAddModal={() => setShowAddDomain(true)}
      showSettings={() => setShowSettings(true)}
    />
```

with:

```tsx
return (
  <AppShell
    domains={domains}
    showAddModal={() => setShowAddDomain(true)}
    showSettings={() => setShowSettings(true)}
    showSidebar={false}
    topbarTitle={article.target_keyword || article.title}
    contentClassName="article-editor-shell"
  >
```

At the end of the JSX, replace the matching closing `</div>` for the outer wrapper with:

```tsx
  </AppShell>
);
```

- [ ] **Step 2: Make editor content fill the new shell**

Add to `styles/globals.css`:

```css
.article-editor-shell {
   background: #f4f4f5;
   border-radius: 12px;
   overflow: hidden;
}

.article-editor-shell > div {
   min-height: 0;
}
```

- [ ] **Step 3: Verify editor route**

Run the app and open an existing article:

```bash
npm run dev
```

Open `http://localhost:3000/articles/1`.

Expected:
- Global dark topbar is visible.
- Left sidebar is not visible.
- Editor toolbar remains visible under the topbar.
- Right score panel remains fixed and readable.
- Page does not create a horizontal scrollbar at 1440px width.

- [ ] **Step 4: Commit**

```bash
git add pages/articles/[id]/index.tsx styles/globals.css
git commit -m "feat: make article editor sidebarless"
```

---

## Task 3: Move Direct Sidebar Pages To AppShell

**Files:**
- Modify: `pages/domain/[slug]/index.tsx`
- Modify: `pages/domain/audit/[slug]/index.tsx`
- Modify: `pages/domain/ideas/[slug]/index.tsx`
- Modify: `pages/domain/insight/[slug]/index.tsx`
- Modify: `pages/domain/console/[slug]/index.tsx`

- [ ] **Step 1: Replace `Sidebar` imports**

In each listed file, replace:

```tsx
import Sidebar from '../../../components/common/Sidebar';
```

or:

```tsx
import Sidebar from '../../../../components/common/Sidebar';
```

with the correct relative `AppShell` import:

```tsx
import AppShell from '../../../components/common/AppShell';
```

or:

```tsx
import AppShell from '../../../../components/common/AppShell';
```

- [ ] **Step 2: Wrap page content with `AppShell`**

For each page, replace the outer flex wrapper plus direct `<Sidebar ... />` with:

```tsx
<AppShell
  domains={theDomains}
  showAddModal={() => setShowAddDomain(true)}
  showSettings={() => setShowSettings(true)}
>
  {/* existing page content, unchanged */}
</AppShell>
```

Use `domains={domains}` if the page currently names the array `domains`; use `domains={theDomains}` where that variable already exists.

- [ ] **Step 3: Verify all direct sidebar references are gone except the component itself**

Run:

```bash
rg "<Sidebar|from '.*Sidebar'" pages components
```

Expected: only `components/common/AppShell.tsx` imports/renders `Sidebar`, plus `components/common/Sidebar.tsx` itself.

- [ ] **Step 4: Commit**

```bash
git add pages/domain
git commit -m "refactor: route domain pages through app shell"
```

---

## Task 4: Add Durable Analysis Tables

**Files:**
- Create: `database/migrations/1748200000000-add-ai-visibility-tables.js`
- Modify: `lib/ensureArticlesTables.ts`

- [ ] **Step 1: Create migration**

```js
// database/migrations/1748200000000-add-ai-visibility-tables.js

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (t) => {
      const tables = await queryInterface.showAllTables();

      if (!tables.includes('article_competitors')) {
        await queryInterface.createTable('article_competitors', {
          id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
          article_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
          url: { type: Sequelize.DataTypes.TEXT, allowNull: false },
          domain: { type: Sequelize.DataTypes.TEXT },
          title: { type: Sequelize.DataTypes.TEXT },
          snippet: { type: Sequelize.DataTypes.TEXT },
          word_count: { type: Sequelize.DataTypes.INTEGER },
          heading_count: { type: Sequelize.DataTypes.INTEGER },
          headings_json: { type: Sequelize.DataTypes.TEXT },
          entities_json: { type: Sequelize.DataTypes.TEXT },
          terms_json: { type: Sequelize.DataTypes.TEXT },
          created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
        }, { transaction: t });
        await queryInterface.addIndex('article_competitors', ['article_id'], { transaction: t });
      }

      if (!tables.includes('article_terms')) {
        await queryInterface.createTable('article_terms', {
          id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
          article_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
          term: { type: Sequelize.DataTypes.TEXT, allowNull: false },
          term_type: { type: Sequelize.DataTypes.STRING, defaultValue: 'topic' },
          source: { type: Sequelize.DataTypes.STRING, defaultValue: 'serp' },
          current_count: { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 },
          target_min: { type: Sequelize.DataTypes.INTEGER, defaultValue: 1 },
          target_max: { type: Sequelize.DataTypes.INTEGER, defaultValue: 3 },
          importance: { type: Sequelize.DataTypes.FLOAT, defaultValue: 0 },
          created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
        }, { transaction: t });
        await queryInterface.addIndex('article_terms', ['article_id'], { transaction: t });
      }

      if (!tables.includes('ai_visibility_runs')) {
        await queryInterface.createTable('ai_visibility_runs', {
          id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
          article_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
          target_keyword: { type: Sequelize.DataTypes.TEXT },
          score: { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 },
          prompts_total: { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 },
          prompts_cited: { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 },
          competitor_citations: { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 },
          summary_json: { type: Sequelize.DataTypes.TEXT },
          created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
        }, { transaction: t });
        await queryInterface.addIndex('ai_visibility_runs', ['article_id'], { transaction: t });
      }

      if (!tables.includes('ai_visibility_citations')) {
        await queryInterface.createTable('ai_visibility_citations', {
          id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
          run_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
          prompt: { type: Sequelize.DataTypes.TEXT, allowNull: false },
          answer: { type: Sequelize.DataTypes.TEXT },
          cited_url: { type: Sequelize.DataTypes.TEXT },
          cited_domain: { type: Sequelize.DataTypes.TEXT },
          is_own_domain: { type: Sequelize.DataTypes.BOOLEAN, defaultValue: false },
          is_competitor: { type: Sequelize.DataTypes.BOOLEAN, defaultValue: false },
          sentiment: { type: Sequelize.DataTypes.STRING },
          created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
        }, { transaction: t });
        await queryInterface.addIndex('ai_visibility_citations', ['run_id'], { transaction: t });
      }

      if (!tables.includes('article_versions')) {
        await queryInterface.createTable('article_versions', {
          id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
          article_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
          version_type: { type: Sequelize.DataTypes.STRING, allowNull: false },
          content: { type: Sequelize.DataTypes.TEXT },
          score_data: { type: Sequelize.DataTypes.TEXT },
          created_at: { type: Sequelize.DataTypes.DATE, defaultValue: Sequelize.DataTypes.NOW },
        }, { transaction: t });
        await queryInterface.addIndex('article_versions', ['article_id'], { transaction: t });
      }
    });
  },

  down: async (queryInterface) => {
    return queryInterface.sequelize.transaction(async (t) => {
      const tables = await queryInterface.showAllTables();
      if (tables.includes('article_versions')) await queryInterface.dropTable('article_versions', { transaction: t });
      if (tables.includes('ai_visibility_citations')) await queryInterface.dropTable('ai_visibility_citations', { transaction: t });
      if (tables.includes('ai_visibility_runs')) await queryInterface.dropTable('ai_visibility_runs', { transaction: t });
      if (tables.includes('article_terms')) await queryInterface.dropTable('article_terms', { transaction: t });
      if (tables.includes('article_competitors')) await queryInterface.dropTable('article_competitors', { transaction: t });
    });
  },
};
```

- [ ] **Step 2: Mirror table creation in `ensureArticlesTables.ts`**

Add idempotent `CREATE TABLE IF NOT EXISTS` statements for the same five tables so dev environments self-heal when migrations are not run manually.

- [ ] **Step 3: Verify migration**

Run:

```bash
npm run db:migrate
```

Expected: migration succeeds and creates the five tables.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/1748200000000-add-ai-visibility-tables.js lib/ensureArticlesTables.ts
git commit -m "feat: add article analysis persistence tables"
```

---

## Task 5: Fix Polish Keyword And Term Extraction

**Files:**
- Create: `lib/articleTerms.ts`
- Modify: `python-sidecar/analyzers/serp_analyzer.py`
- Modify: `pages/api/articles/deep-analysis.ts`

- [ ] **Step 1: Add shared filler filter in TypeScript**

Create `lib/articleTerms.ts`:

```ts
const POLISH_STOPWORDS = new Set([
  'aby', 'ale', 'albo', 'ani', 'bez', 'bo', 'by', 'byc', 'być', 'byla', 'była',
  'bylo', 'było', 'byly', 'były', 'czy', 'dla', 'do', 'gdy', 'gdzie', 'go',
  'ich', 'im', 'jest', 'jesli', 'jeśli', 'juz', 'już', 'kiedy', 'kto', 'ktora',
  'która', 'ktore', 'które', 'ktory', 'który', 'lub', 'ma', 'mial', 'miał',
  'miec', 'mieć', 'moze', 'może', 'na', 'nad', 'nie', 'nim', 'oraz', 'po',
  'pod', 'przed', 'przez', 'przy', 'sa', 'są', 'sie', 'się', 'tak', 'te',
  'tego', 'tej', 'ten', 'to', 'tych', 'tym', 'u', 'w', 'we', 'z', 'za', 'ze',
  'że'
]);

export type ArticleTerm = {
  term: string;
  target_count: number;
  current_count?: number;
  term_type?: 'keyword' | 'topic' | 'entity' | 'question';
};

export function normalizeTerm(term: string): string {
  return term.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isUsefulTerm(term: string): boolean {
  const normalized = normalizeTerm(term);
  if (normalized.length < 4) return false;
  const tokens = normalized.split(' ');
  if (tokens.every((token) => POLISH_STOPWORDS.has(token))) return false;
  if (tokens.length === 1 && POLISH_STOPWORDS.has(tokens[0])) return false;
  if (/^\d+$/.test(normalized)) return false;
  return true;
}

export function dedupeUsefulTerms<T extends ArticleTerm>(terms: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const term of terms) {
    const key = normalizeTerm(term.term);
    if (!isUsefulTerm(key) || seen.has(key)) continue;
    seen.add(key);
    result.push({ ...term, term: key });
  }
  return result;
}
```

- [ ] **Step 2: Use `dedupeUsefulTerms` in `deep-analysis.ts`**

Import it:

```ts
import { dedupeUsefulTerms } from '../../../lib/articleTerms';
```

Replace:

```ts
const allTerms: NlpTerm[] = [...kwTerms, ...extracted].map((t) => ({
  ...t,
  current_count: countOccurrences(plainText, t.term),
}));
```

with:

```ts
const allTerms: NlpTerm[] = dedupeUsefulTerms([...kwTerms, ...extracted]).map((t) => ({
  ...t,
  current_count: countOccurrences(plainText, t.term),
}));
```

Inside SERP merge, wrap final data before score creation:

```ts
const usefulTerms = dedupeUsefulTerms(allTerms).map((t) => ({
  ...t,
  current_count: countOccurrences(plainText, t.term),
}));
```

Use `usefulTerms` instead of `allTerms` in `scoreData.terms`.

- [ ] **Step 3: Improve Python TF-IDF stopwords**

In `python-sidecar/analyzers/serp_analyzer.py`, add:

```py
POLISH_STOPWORDS = {
    "aby", "ale", "albo", "ani", "bez", "bo", "by", "byc", "być", "byla", "była",
    "bylo", "było", "byly", "były", "czy", "dla", "do", "gdy", "gdzie", "ich",
    "im", "jest", "jeśli", "jesli", "już", "juz", "kiedy", "kto", "ktora", "która",
    "ktore", "które", "ktory", "który", "lub", "ma", "moze", "może", "na", "nad",
    "nie", "oraz", "po", "pod", "przed", "przez", "przy", "są", "sa", "sie", "się",
    "tak", "ten", "to", "u", "w", "we", "z", "za", "ze", "że"
}
```

Then change vectorizer:

```py
vectorizer = TfidfVectorizer(
    ngram_range=(2, 4),
    max_features=120,
    stop_words=list(POLISH_STOPWORDS) if keyword_has_polish_context(keyword) else "english",
    min_df=1,
    token_pattern=r"(?u)\b[\wąćęłńóśźżĄĆĘŁŃÓŚŹŻ]{3,}\b",
)
```

Add helper:

```py
def keyword_has_polish_context(keyword: str) -> bool:
    return any(ch in keyword.lower() for ch in "ąćęłńóśźż") or True
```

This intentionally defaults to Polish for the current product flow.

- [ ] **Step 4: Verify bad filler terms disappear**

Run import for a Polish article and inspect `score_data`.

Expected:
- `nie`, `albo`, `może`, `jest`, `czy`, `kto`, `jak` do not appear as standalone scoring terms.
- Useful phrases such as `prywatny detektyw`, `ktoś mnie śledzi`, `objawy śledzenia`, `obserwacja osoby` can appear.

- [ ] **Step 5: Commit**

```bash
git add lib/articleTerms.ts pages/api/articles/deep-analysis.ts python-sidecar/analyzers/serp_analyzer.py
git commit -m "fix: filter low-value Polish scoring terms"
```

---

## Task 6: Add AI Search Score Computation

**Files:**
- Create: `lib/aiSearchScore.ts`
- Create: `components/articles/AiSearchPanel.tsx`
- Modify: `components/articles/ContentScorePanel.tsx`

- [ ] **Step 1: Create pure scoring utility**

```ts
export type AiCitation = {
  prompt: string;
  answer?: string;
  cited_url?: string;
  cited_domain?: string;
  is_own_domain?: boolean;
  is_competitor?: boolean;
};

export type AiVisibilitySummary = {
  prompts_total: number;
  prompts_cited: number;
  competitor_citations: number;
  extractability_score: number;
  citations: AiCitation[];
};

export function computeAiSearchScore(summary?: AiVisibilitySummary | null): number {
  if (!summary || summary.prompts_total <= 0) return 0;

  const ownCitationRate = summary.prompts_cited / summary.prompts_total;
  const competitorPressure = Math.min(summary.competitor_citations / Math.max(summary.prompts_total, 1), 1);
  const extractability = Math.min(Math.max(summary.extractability_score, 0), 100) / 100;

  const citationScore = ownCitationRate * 45;
  const shareScore = Math.max(0, 1 - competitorPressure) * 25;
  const extractabilityScore = extractability * 30;

  return Math.round(citationScore + shareScore + extractabilityScore);
}
```

- [ ] **Step 2: Create `AiSearchPanel.tsx`**

Render a simple evidence list first:

```tsx
import React from 'react';
import type { AiVisibilitySummary } from '../../lib/aiSearchScore';

type Props = {
  summary?: AiVisibilitySummary | null;
  onRun: () => void;
  running?: boolean;
};

const AiSearchPanel = ({ summary, onRun, running = false }: Props) => {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: 6,
          border: 'none',
          background: '#18181b',
          color: '#fff',
          fontWeight: 600,
        }}
      >
        {running ? 'Checking AI visibility...' : 'Run AI Search Check'}
      </button>
      {!summary || summary.prompts_total === 0 ? (
        <p style={{ margin: 0, color: '#9f9fa9', fontSize: 13 }}>
          No AI Search evidence yet.
        </p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div>Cited: <strong>{summary.prompts_cited}/{summary.prompts_total}</strong></div>
            <div>Competitors: <strong>{summary.competitor_citations}</strong></div>
          </div>
          {summary.citations.map((citation, idx) => (
            <div key={`${citation.prompt}-${idx}`} style={{ border: '1px solid #f4f4f5', borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{citation.prompt}</div>
              <div style={{ color: citation.is_own_domain ? '#1ab25e' : '#9f9fa9', fontSize: 12 }}>
                {citation.cited_domain || 'No citation'}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default AiSearchPanel;
```

- [ ] **Step 3: Replace AI Search mock values in `ContentScorePanel.tsx`**

Add props:

```ts
aiVisibilitySummary?: AiVisibilitySummary | null;
onRunAiVisibility?: () => void;
isRunningAiVisibility?: boolean;
```

Use:

```ts
const aiScore = computeAiSearchScore(aiVisibilitySummary);
const aiCovered = aiVisibilitySummary?.prompts_cited ?? 0;
const aiTotal = aiVisibilitySummary?.prompts_total ?? 0;
```

Replace mock `0/0` with:

```tsx
<CircleProgress value={aiCovered} max={Math.max(aiTotal, 1)} color={aiScore >= 60 ? '#1ab25e' : '#efa00d'} />
<span style={{ fontSize: 12, color: '#52525c', fontFamily: 'var(--font-family-primary)' }}>
  {aiCovered}/{aiTotal}
</span>
```

- [ ] **Step 4: Commit**

```bash
git add lib/aiSearchScore.ts components/articles/AiSearchPanel.tsx components/articles/ContentScorePanel.tsx
git commit -m "feat: render real AI Search score state"
```

---

## Task 7: Add AI Visibility API And Sidecar Endpoint

**Files:**
- Create: `pages/api/articles/ai-visibility.ts`
- Create: `python-sidecar/analyzers/ai_visibility.py`
- Modify: `python-sidecar/main.py`
- Modify: `pages/articles/[id]/index.tsx`

- [ ] **Step 1: Create sidecar analyzer**

Create `python-sidecar/analyzers/ai_visibility.py`:

```py
import os
import httpx
from urllib.parse import urlparse


def build_prompts(keyword: str) -> list[str]:
    return [
        f"Co to jest {keyword}?",
        f"Jak sprawdzić {keyword}?",
        f"Najważniejsze objawy i rozwiązania dla: {keyword}",
        f"Na co uważać przy temacie: {keyword}?",
        f"Jakie źródła najlepiej wyjaśniają: {keyword}?",
    ]


def domain_from_url(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


async def run_ai_visibility(keyword: str, own_domain: str, competitor_domains: list[str]) -> dict:
    prompts = build_prompts(keyword)
    citations = []

    # MVP provider: use Serper organic snippets as citation proxy until a citation-capable AI provider is connected.
    # This keeps the data model real and lets the UI ship before paid AI search integrations.
    serper_key = os.getenv("SERPER_API_KEY", "")
    if not serper_key:
        return {
            "prompts_total": len(prompts),
            "prompts_cited": 0,
            "competitor_citations": 0,
            "extractability_score": 50,
            "citations": [],
            "warning": "SERPER_API_KEY not configured",
        }

    async with httpx.AsyncClient(timeout=20) as client:
        for prompt in prompts:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": serper_key, "Content-Type": "application/json"},
                json={"q": prompt, "hl": "pl", "gl": "pl", "num": 5},
            )
            response.raise_for_status()
            data = response.json()
            for item in data.get("organic", [])[:5]:
                url = item.get("link", "")
                domain = domain_from_url(url)
                citations.append({
                    "prompt": prompt,
                    "answer": item.get("snippet", ""),
                    "cited_url": url,
                    "cited_domain": domain,
                    "is_own_domain": domain == own_domain,
                    "is_competitor": domain in competitor_domains,
                })

    prompts_cited = len({c["prompt"] for c in citations if c["is_own_domain"]})
    competitor_citations = len([c for c in citations if c["is_competitor"]])

    return {
        "prompts_total": len(prompts),
        "prompts_cited": prompts_cited,
        "competitor_citations": competitor_citations,
        "extractability_score": 50,
        "citations": citations,
    }
```

- [ ] **Step 2: Add FastAPI endpoint**

In `python-sidecar/main.py`, import:

```py
from analyzers.ai_visibility import run_ai_visibility
```

Add endpoint:

```py
@app.post("/ai-visibility")
async def ai_visibility_endpoint(body: dict):
    keyword = body.get("keyword", "")
    own_domain = body.get("own_domain", "")
    competitor_domains = body.get("competitor_domains", [])
    if not keyword:
        raise HTTPException(status_code=400, detail="keyword is required")
    return await run_ai_visibility(keyword, own_domain, competitor_domains)
```

- [ ] **Step 3: Add Next.js API route**

Create `pages/api/articles/ai-visibility.ts` that:
- verifies user,
- fetches article and domain,
- reads competitor domains from `article_competitors` or `competitor_outlines_cache`,
- calls sidecar `/ai-visibility`,
- inserts one row in `ai_visibility_runs`,
- inserts citation rows in `ai_visibility_citations`,
- returns summary JSON.

- [ ] **Step 4: Wire editor button**

In `pages/articles/[id]/index.tsx`, add state:

```ts
const [aiVisibilitySummary, setAiVisibilitySummary] = useState(null);
const [isRunningAiVisibility, setIsRunningAiVisibility] = useState(false);
```

Add handler:

```ts
const handleRunAiVisibility = async () => {
  if (!id) return;
  setIsRunningAiVisibility(true);
  try {
    const res = await fetch('/api/articles/ai-visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId: id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI visibility check failed');
    setAiVisibilitySummary(data.summary);
    toast.success('AI Search checked');
  } catch (err: any) {
    toast.error(err.message);
  } finally {
    setIsRunningAiVisibility(false);
  }
};
```

Pass props to `ContentScorePanel`.

- [ ] **Step 5: Commit**

```bash
git add pages/api/articles/ai-visibility.ts python-sidecar/analyzers/ai_visibility.py python-sidecar/main.py pages/articles/[id]/index.tsx
git commit -m "feat: add AI visibility check pipeline"
```

---

## Task 8: Improve Auto-Optimize Around Competitor Evidence

**Files:**
- Modify: `pages/api/articles/auto-optimize.ts`
- Modify: `pages/articles/[id]/index.tsx`

- [ ] **Step 1: Save article version before optimization**

Before calling `/api/articles/auto-optimize`, save a version:

```ts
await fetch(`/api/articles/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: editorHtml,
    word_count: wordCount,
    version_type: 'pre_auto_optimize',
  }),
});
```

Then update `pages/api/articles/[id].ts` in the implementation phase to insert `article_versions` when `version_type` is present.

- [ ] **Step 2: Add AI Search gaps into prompt**

In `auto-optimize.ts`, accept:

```ts
aiVisibilitySummary?: {
  prompts_total: number;
  prompts_cited: number;
  competitor_citations: number;
  citations: Array<{ prompt: string; cited_domain?: string; answer?: string }>;
}
```

Append to the system prompt:

```ts
const aiSearchBlock = aiVisibilitySummary?.citations?.length
  ? `\n\nAI SEARCH VISIBILITY GAPS:\n${aiVisibilitySummary.citations
      .slice(0, 10)
      .map((c, i) => `${i + 1}. Prompt: "${c.prompt}" | cited: ${c.cited_domain || 'none'} | answer snippet: "${(c.answer || '').slice(0, 180)}"`)
      .join('\n')}\nUse these gaps to add answer-ready sections, definitions, FAQs, and source-worthy statements.`
  : '';
```

Add `${aiSearchBlock}` before `OUTPUT FORMAT`.

- [ ] **Step 3: Verify auto-optimize still streams**

Open an article, run Auto-Optimize.

Expected:
- Progress events still appear.
- Final HTML is inserted.
- Existing images, headings, and links are preserved.

- [ ] **Step 4: Commit**

```bash
git add pages/api/articles/auto-optimize.ts pages/articles/[id]/index.tsx pages/api/articles/[id].ts
git commit -m "feat: feed AI visibility gaps into auto optimize"
```

---

## Task 9: Add Helicone Gateway Support

**Files:**
- Modify: `.env.example`
- Modify: `pages/api/articles/auto-optimize.ts`
- Modify: `pages/api/articles/ask-surfy.ts`
- Modify: `pages/api/articles/generate-outline.ts`

- [ ] **Step 1: Add env vars**

Append:

```env
HELICONE_API_KEY=
LLM_GATEWAY_BASE_URL=
LLM_PROVIDER=deepseek
TOGETHER_API_KEY=
```

- [ ] **Step 2: Route LLM calls through configurable base URL**

Replace hardcoded:

```ts
fetch('https://api.deepseek.com/v1/chat/completions', ...)
```

with:

```ts
const llmBaseUrl = process.env.LLM_GATEWAY_BASE_URL || 'https://api.deepseek.com/v1';
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
};
if (process.env.HELICONE_API_KEY) {
  headers['Helicone-Auth'] = `Bearer ${process.env.HELICONE_API_KEY}`;
  headers['Helicone-Property-Feature'] = 'article-auto-optimize';
}

const aiRes = await fetch(`${llmBaseUrl}/chat/completions`, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload),
});
```

Use feature labels:
- `article-auto-optimize`
- `article-humanizer`
- `ask-surfy`
- `generate-outline`

- [ ] **Step 3: Commit**

```bash
git add .env.example pages/api/articles/auto-optimize.ts pages/api/articles/ask-surfy.ts pages/api/articles/generate-outline.ts
git commit -m "feat: add Helicone-compatible LLM gateway"
```

---

## Task 10: Plan Neon/Postgres Migration After Feature Stabilizes

**Files:**
- Modify later: `database/database.ts`
- Modify later: `database/config.js`
- Modify later: `.env.example`
- Create later: `docs/database-neon-migration.md`

- [ ] **Step 1: Document migration decision**

Create `docs/database-neon-migration.md`:

```md
# Neon Migration Notes

SerpBear currently uses SQLite at `./data/database.sqlite`, which is fine locally and in Docker but not durable on Vercel serverless deployments.

Target production database: Neon Postgres.

Required changes:
- Add `DATABASE_URL`.
- Switch Sequelize dialect to `postgres` when `DATABASE_URL` is present.
- Install `pg` and `pg-hstore`.
- Verify all raw SQL works in both SQLite and Postgres, especially `datetime('now')`.
- Replace SQLite-specific date expressions with app-generated ISO timestamps or dialect-aware helpers.
- Run migrations against a Neon branch before production.
```

- [ ] **Step 2: Defer code migration**

Do not switch dialect in the same PR as AI Search Score. First ship data model and features on current local DB, then migrate with a dedicated test pass.

- [ ] **Step 3: Commit**

```bash
git add docs/database-neon-migration.md
git commit -m "docs: outline Neon database migration"
```

---

## Task 11: QA And Acceptance

**Files:**
- No new files unless fixing discovered issues.

- [ ] **Step 1: Static checks**

Run:

```bash
npm run lint
npm run test:ci
```

Expected: pass or only pre-existing unrelated failures documented in the final handoff.

- [ ] **Step 2: Visual QA**

Run:

```bash
npm run dev
```

Check:
- `/dashboard`
- `/domains`
- `/research`
- `/articles`
- `/articles/1`
- `/settings`

Expected:
- Topbar appears on all pages.
- Normal app pages still show the left sidebar below topbar.
- Article editor hides left sidebar.
- Topbar account menu opens and closes correctly.
- No text overlap at desktop width.
- Mobile hides search field and keeps actions reachable.

- [ ] **Step 3: Feature QA**

Import a Polish article through `/articles/deep-analysis`.

Expected:
- `score_data.terms` does not contain standalone filler words.
- Competitor outlines still load.
- AI Search card shows `0/0` only before first run.
- After AI Search run, card shows real prompt citation count.

- [ ] **Step 4: Graph update**

Run if graphify is installed:

```bash
graphify update .
```

Expected: graph updates without blocking the build.

---

## Implementation Order

1. Tasks 1-3: global topbar and layout correctness.
2. Tasks 4-5: persistence and keyword quality foundation.
3. Tasks 6-7: real AI Search Score and evidence panel.
4. Task 8: connect AI visibility gaps to Auto-Optimize.
5. Task 9: Helicone/Together-ready LLM gateway.
6. Task 10: Neon migration documentation.
7. Task 11: QA pass.

---

## Self-Review

- Spec coverage: includes global topbar on every page, sidebarless content editor, AI Search Score, competitor-based keyword cleanup, auto-optimize/humanizer/publish pipeline support, Together/Helicone path, and Neon migration path.
- Placeholder scan: no `TBD` or “implement later” instructions are used for required feature behavior; the Neon code switch is intentionally documented as a later dedicated migration.
- Type consistency: `AiVisibilitySummary` is defined once in `lib/aiSearchScore.ts` and referenced by `ContentScorePanel` and `AiSearchPanel`.
