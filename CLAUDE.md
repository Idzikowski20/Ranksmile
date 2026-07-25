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
2. **Przeczytaj `DESIGN.md` przed napisaniem jakiegokolwiek kodu UI** — Sentry-first design system
3. Ściśle stosuj `DESIGN.md` — nie wymyślaj nowych kolorów, rozmiarów, shadowów, border-radiusów

### Architektura UI

- **Shell:** ciemny Sentry — bg `#252525` / `#09090b`, border `#221e28`
- **App content:** jasny — page `#F8F8F9`, karty białe, border `#DAD9DE`, radius `8px`
- **Styling poza edytorem:** `components/core` + Emotion / CSS vars — bez nowych Tailwind klas
- **Editor zone:** KEEP TipTap/scoring; primitives z `core`
- **Font:** `var(--font-family-primary)` / Rubik w shell — nigdy hardcode Inter jako brand
- **Ikony:** wyłącznie inline SVG

### Kluczowe tokeny (Sentry / Ranksmile)

| Token | Wartość | Kiedy |
|-------|---------|--------|
| Accent | `#F29964` | primary CTA, focus, active |
| Accent chonk | `#C97D52` | Button primary underside |
| Card border | `#DAD9DE` | karty / panele Sentry |
| Page bg | `#F8F8F9` | content areas |
| Headings | `#181225` | titles |
| Body | `#302E36` | primary text |
| Muted | `#6A6772` | secondary |

**Nie używaj** Ranksmile purple `#783AFB` jako brand accent w nowym UI (legacy tylko w `scoreColor.ts`). Anti-slop: `DESIGN.md` §12.

### Struktura

```
components/core/           — Button, Modal, Input, theme.tsx
components/sentry-pages/   — SentryPage, Panel, Table
components/ranksmile/         — Gauge, SelectionBar (KEEP)
components/common/AppShell.tsx
styles/globals.css         — CSS vars + shell
```

Szczegóły → `DESIGN.md`.

## 7. TypeScript — no `any`

**Nigdy nie pisz kodu z typem `any`.** Dotyczy nowego kodu i każdej edycji dotykanej linii.

Zabronione: `: any`, `as any`, `<any>`, `any[]`, `Record<string, any>`, domyślne `T = any`.

Zamiast tego używaj `unknown` + zawężenie, `Record<string, unknown>`, konkretnych typów z `lib/types/` (`db.ts`, `sidecar.ts`, `editor.ts`, `json.ts`, `api.ts`), generyków (`callSidecar<T>`, `parseJsonish<T>`, `queryOne<Row>`) oraz typów z bibliotek (TipTap `Editor`, Next.js API types).

Wyjątki tylko w `__tests__` / `__mocks__` (preferuj typowane fixture’y). Legacy poza scope zadania — nie dodawaj nowego `any`; typuj tylko zmieniane linie. Dotykasz `any` → zamień w tej samej zmianie.
