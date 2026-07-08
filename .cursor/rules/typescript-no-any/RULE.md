---
description: Zakaz any w TypeScript — unknown, generyki, lib/types
globs: "**/*.{ts,tsx}"
alwaysApply: false
---

# TypeScript — no `any`

Pełna wersja: `@AGENTS.md` §7. Dotyczy każdej nowej linii i każdej edytowanej linii z `any`.

## Zabronione

`: any`, `as any`, `<any>`, `any[]`, `Record<string, any>`, domyślne `T = any`

## Zamiast tego

| Sytuacja | Rozwiązanie |
|----------|-------------|
| JSON / API | `unknown` + type guard lub `parseJsonish<T>()` |
| Dynamiczny obiekt | `Record<string, unknown>` |
| Wspólne typy | `lib/types/` — `@lib/types/db.ts`, `api.ts`, `editor.ts`, `json.ts`, `sidecar.ts` |
| Sidecar / DB | `callSidecar<T>()`, `queryOne<Row>()` |
| Biblioteki | typy z pakietu (`Editor`, `JSONContent`, `NextApiResponse`, Sequelize) |

## Wyjątki

- `__tests__` / `__mocks__` — typowane fixture'y zamiast `any`
- Legacy poza scope — nie rozszerzaj `any`; typuj tylko zmieniane fragmenty
- Konieczny `any` → `// eslint-disable` + jednozdaniowe uzasadnienie

Przy refaktorze: dotknięta linia z `any` → popraw typ w tej samej zmianie.
