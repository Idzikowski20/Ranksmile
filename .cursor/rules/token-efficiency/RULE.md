---
description: Oszczędzanie tokenów kontekstu — nawigacja, czytanie plików, odpowiedzi
alwaysApply: true
---

# Token efficiency

Zasady z [cursor-rules-reference](https://github.com/sanjeed5/awesome-cursor-rules-mdc/blob/main/cursor-rules-reference.md): krótkie reguły, jeden temat, odwołania `@plik` zamiast wklejania kodu.

## Kontekst i nawigacja

- **Najpierw grep/glob** — nie czytaj całych plików bez potrzeby; używaj `offset`/`limit`.
- **Architektura / „jak X łączy się z Y"** → reguła `@graphify-navigation`, nie pełny scan repo.
- **Nie czytaj** `.next/`, `node_modules/`, `wordpress-plugin/`, `graphify-out/` (są w `.cursorignore`).
- **Subagenty Task** tylko przy szerokim audycie; przy wąskim zadaniu — grep + 1–3 pliki.
- **Nie duplikuj** treści z `@AGENTS.md` / `@CLAUDE.md` — odwołuj się do nich.

## Edycje

- Surgical diff — tylko linie wymagane przez zadanie (§1–3 w `@AGENTS.md`).
- Nie refaktoruj sąsiedniego kodu „przy okazji".
- Po zmianach kodu: `graphify update .` (AST, bez kosztu API).

## Odpowiedzi

- Język: **polski**, zwięzły styl techniczny.
- Cytaty kodu: format `startLine:endLine:path`, bez wklejania dużych bloków.
- Bez zbędnych todo/subagentów dla prostych zadań.
