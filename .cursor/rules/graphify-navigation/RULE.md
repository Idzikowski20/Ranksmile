---
description: Nawigacja po codebase przez graphify zamiast pełnego grepa
alwaysApply: false
---

# Graphify navigation

Projekt ma graf wiedzy w `graphify-out/`. Używaj go przed masowym czytaniem plików.

## Kiedy

- Pytania architektoniczne, przepływy biznesowe, zależności między modułami
- „Gdzie jest X?", „jak Y woła Z?", onboarding w nieznanym obszarze

## Workflow

1. `@graphify-out/GRAPH_REPORT.md` — god nodes, communities
2. Jeśli istnieje `@graphify-out/wiki/index.md` — nawiguj wiki, nie raw pliki
3. Cross-module: `graphify query "…"`, `graphify path "A" "B"`, `graphify explain "…"`
4. Po edycji plików źródłowych w sesji: `graphify update .`

## Kiedy NIE

- Znany plik/funkcja → bezpośredni grep lub read
- Pojedyncza linijka / bugfix w jednym pliku
