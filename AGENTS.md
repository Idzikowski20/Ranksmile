# ────────────────────────────────────────────────────────────
# Andrej Karpathy Coding Guidelines
# ────────────────────────────────────────────────────────────

# AGENTS.md

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
- Use always /frontend-design
- Read before do anything design.md
- Stick design.md

## 7. TypeScript — no `any`

**Nigdy nie pisz kodu z typem `any`.** Dotyczy nowego kodu i każdej edycji dotykanej linii.

Zabronione:
- `: any`, `as any`, `<any>`, `any[]`, `Record<string, any>`, domyślne `T = any`

Zamiast tego:
- **`unknown`** + zawężenie (`typeof`, type guard, `parseJsonish<T>()`)
- **`Record<string, unknown>`** dla obiektów o dynamicznym kształcie
- **Konkretne typy / interfejsy** — definiuj lokalnie lub w `lib/types/` (`db.ts`, `sidecar.ts`, `editor.ts`, `json.ts`, `api.ts`)
- **Generyki** — `callSidecar<T>()`, `parseJsonish<T>()`, `queryOne<Row>()`
- **Typy bibliotek** — np. `Editor` / `JSONContent` z `@tiptap/core`, `NextApiResponse`, typy Sequelize

Wyjątki (tylko gdy absolutnie konieczne, z komentarzem `// eslint-disable` + uzasadnienie):
- pliki testowe/mocki (`__tests__`, `__mocks__`) — preferuj typowane fixture’y
- legacy pliki poza scope’em zadania — nie rozszerzaj `any`; typuj tylko zmieniane fragmenty

Przy refaktorze: jeśli dotykasz linii z `any`, zamień ją na właściwy typ w tej samej zmianie.

## Cursor Cloud specific instructions

This repo is a heavily forked SerpBear + "SEO Autopilot". Two services run in dev; the standard scripts live in `package.json` and `python-sidecar/`. The startup layer (`npm install` + sidecar venv/pip install) is handled by the environment update script — the notes below cover only non-obvious caveats.

### Running the two services (do NOT use `npm run dev` here)
`npm run dev` (mprocs via `mprocs.yaml`) and `python-sidecar/dev.cmd` are **Windows-only** (`cmd /C`, `.venv\Scripts\...`) and fail on Linux. Start the processes manually instead:
- Web app: `npm run dev:next` → http://localhost:3000
- Python sidecar (FastAPI): `cd python-sidecar && .venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8001` → http://localhost:8001 (health at `/health`). Next→sidecar URL is `PYTHON_SIDECAR_URL` (see `lib/sidecar.ts`).
- Cron worker (optional): `npm run cron`.

### Env files (gitignored, must be created locally)
- `.env.local` at repo root and `python-sidecar/.env` (templates: `.env.example`, `python-sidecar/.env.example`). Minimal working set for the app: `USER`/`USER_NAME`, `PASSWORD`, `SECRET`, `NEXT_PUBLIC_APP_URL`, `PYTHON_SIDECAR_URL`, `AUTH0_SECRET`.

### External dependencies / auth (important gotcha)
- Full Neon Auth login (`/auth/sign-in`) needs `NEON_AUTH_BASE_URL` + a Neon Auth backend, and multi-tenant data needs `DATABASE_URL` (Neon Postgres). Without them the app boots fine and serves the DigitX marketing homepage; the legacy `POST /api/login` still authenticates with `USER`/`PASSWORD`.
- DB defaults to **SQLite** at `./data/database.sqlite` (auto-created, `data/` is gitignored) unless `DATABASE_URL` is set.
- AI content generation needs `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY`; without them the sidecar's content **scoring** still works and falls back to a rule-based score (see `analyzers/ranking_scorer.py`). Real SERP scraping/keyword research need provider keys configured at runtime in Settings.
- `spacy` is in `requirements.txt` but is not actually imported (NLP uses scikit-learn TF-IDF) — no spaCy model download is required.

### Lint / test caveats
- `npm run lint` currently reports thousands of **pre-existing** errors; the build does not gate on ESLint (`next.config.js` sets `eslint.ignoreDuringBuilds: true`). Do not attempt to fix these wholesale.
- `npm run test:ci` (Jest) has some pre-existing failing suites (as of setup: 4 suites / 11 tests failing, 789 passing). Treat those as the baseline, not caused by your change.
- Sidecar tests: `cd python-sidecar && .venv/bin/python -m pytest` (pytest is installed by the update script; it is not in `requirements.txt`).
