# ────────────────────────────────────────────────────────────
# Andrej Karpathy Coding Guidelines
# ────────────────────────────────────────────────────────────

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 5. Always use skills 
- You can use appwrite-typescript / appwrite-cli
- You can use find-skills
- You can use supabase-postgres-best-practices
- You can use supabase-nextjs
- You can use supabase skills
- you can use all available /plugins before you start editing code. 
depends on what project use'ing.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## 6. Design Frontend

**OBOWIĄZUJE NA TYM PROJEKCIE — BEZ WYJĄTKU:**

1. Przed każdą zmianą UI uruchom skill `/frontend-design`
2. **Przeczytaj `design.md` przed napisaniem jakiegokolwiek kodu UI** — zawiera kompletny design system
3. Ściśle stosuj `design.md` — nie wymyślaj nowych kolorów, rozmiarów, shadowów, border-radiusów

### Architektura UI tego projektu

- **Shell (sidebar + topbar):** ciemny motyw — bg `#09090b`, sidebar bg `#09090b`, border `#221e28`
- **Content areas:** jasny motyw — bg `#f8f9ff`, karty białe z border `#F4F4F5`
- **Styling:** inline styles (nowy kod) + Tailwind (legacy) — **nowy kod = inline styles**
- **Font:** zawsze `var(--font-family-primary)` — nigdy hardcode Inter/Arial
- **Ikony:** wyłącznie inline SVG — brak external icon library

### Kluczowe tokeny do zapamiętania

| Token                  | Wartość     | Kiedy                            |
|------------------------|-------------|----------------------------------|
| Brand purple           | `#783AFB`   | hover na primary button, accents |
| Dark button            | `#2F2F34`   | primary CTA bg                   |
| Card border            | `#F4F4F5`   | wszystkie karty                  |
| Panel border           | `#E4E4E7`   | sekcje, dividers                 |
| Input border           | `#D4D4D8`   | inputs, filter pills             |
| Input focus            | `#AA93FD`   | border + ring rgba(120,58,251,0.1) |
| Success                | `#1AB25E`   | delta up                         |
| Error                  | `#FF6F77`   | delta down                       |
| Content text           | `#18181B`   | primary text w content           |
| Muted text             | `#52525C`   | secondary info                   |

### Struktura plików komponentów

```
pages/
  dashboard/index.tsx          — Dashboard (max-width 880px)
  articles/index.tsx           — Content Editor (max-width 880px)
  domain/[slug]/performance.tsx — Performance (full width)
  domain/[slug]/activity-log.tsx
  domain/[slug]/content-audit.tsx
  domain/[slug]/recommendations.tsx
  domain/[slug]/topical-map.tsx

components/
  common/AppShell.tsx          — GlobalTopbar + Sidebar + main + MobileBottomNav
  common/GlobalTopbar.tsx      — 58px sticky dark topbar
  common/Sidebar.tsx           — 224px dark sidebar z nav items
  common/DashboardLayout.tsx   — layout dla dashboard/articles
  common/Modal.tsx             — legacy modal (Tailwind)
  common/InputField.tsx        — legacy input (Tailwind)

styles/globals.css             — CSS variables + shell styles
```

### Reguły stylu

- Nowy komponent = inline `style={{ }}` — bez nowych Tailwind klas
- Karty: `border: '1px solid #F4F4F5', borderRadius: 12, background: '#FFFFFF'`
- Pills/chips: `borderRadius: 9999`
- Dropdowny: `animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)'`, z-index 150
- Wszystkie hover/transitions: min `150ms ease`
- Nie dodawaj `outline: none` bez własnego focus style

## 7. TypeScript — no `any`

**Nigdy nie pisz kodu z typem `any`.** Dotyczy nowego kodu i każdej edycji dotykanej linii.

Zabronione: `: any`, `as any`, `<any>`, `any[]`, `Record<string, any>`, domyślne `T = any`.

Zamiast tego używaj `unknown` + zawężenie, `Record<string, unknown>`, konkretnych typów z `lib/types/` (`db.ts`, `sidecar.ts`, `editor.ts`, `json.ts`, `api.ts`), generyków (`callSidecar<T>`, `parseJsonish<T>`, `queryOne<Row>`) oraz typów z bibliotek (TipTap `Editor`, Next.js API types).

Wyjątki tylko w `__tests__` / `__mocks__` (preferuj typowane fixture’y). Legacy poza scope zadania — nie dodawaj nowego `any`; typuj tylko zmieniane linie. Dotykasz `any` → zamień w tej samej zmianie.
