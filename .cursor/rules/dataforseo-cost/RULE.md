---
description: Optymalizacja kosztów DataForSEO — budżet SERP, crawl limits
globs: "**/dataforseo*.ts,**/keywordData.ts,**/articleKeywordDiscovery.ts"
alwaysApply: false
---

# DataForSEO cost control

Przy zmianach w integracji DFS utrzymuj niskie koszty API.

## Źródło prawdy

`@lib/dataforseoBudget.ts` — `DFS_SERP_PAA`, `serpCrawlBudget()`, `stopCrawlOnDomain()`

## Zasady

- **PAA / SERP**: `depth: 10`, `max_crawl_pages: 1`, `click_depth: 1` tam gdzie wystarczy
- **AI overview / ai_mode**: `max_crawl_pages: 1` (`@lib/dataforseoLlm.ts`)
- **Labs**: trzymaj limity 300/80; nie podnoś bez uzasadnienia biznesowego
- **Cache**: PAA TTL → `TTL.SERP` (1 dzień); unikaj powtórnych wywołań w jednym flow
- **Discovery**: jeden target `ranked_keywords` + cache `discover-ranked` zamiast wielu requestów

Nowe endpointy DFS → parametry crawl przez `dataforseoBudget`, nie hardcode w wielu plikach.
