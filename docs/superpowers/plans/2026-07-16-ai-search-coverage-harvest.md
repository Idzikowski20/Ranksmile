# AI Search Coverage Harvest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deep-analysis harvests multi-engine LLM/PAA questions into 6–12 semantic topics (3–6 qs each) with icon sources for Info to cover.

**Architecture:** New `harvestAiCoverage` orchestrates DFS fan-out + hybrid outline/LLM clustering + budget; deep-analysis persists richer `ai_info_to_cover`; UI keeps icon sources and prefers harvested topic titles when present.

**Tech Stack:** TypeScript, Jest, DataForSEO LLM (`lib/dataforseoLlm.ts`), existing coverage snapshot pipeline

**Spec:** `docs/superpowers/specs/2026-07-16-ai-search-coverage-harvest-design.md`

---

### Task 1: Types + budget helper

**Files:**
- Create: `lib/harvestAiCoverage.ts` (types + `enforceBudget`)
- Test: `__tests__/lib/harvestAiCoverage.test.ts`

- [ ] Define `HarvestedCoverage`, budget constants (MIN_TOPICS=6, MAX_TOPICS=12, MIN_PER=3, MAX_PER=6)
- [ ] Implement `enforceBudget(topics)` with failing tests first (TDD)
- [ ] Jest green

### Task 2: Outline assignment + cluster helper

**Files:**
- Modify: `lib/harvestAiCoverage.ts`
- Reuse overlap logic from `lib/infoToCoverTopics.ts` (extract shared `assignTopic` / tokenize if needed — avoid duplication)
- Test: `__tests__/lib/harvestAiCoverage.test.ts`

- [ ] `clusterIntoTopics(outlineTitles, questions)` assigns by overlap
- [ ] Unassigned / thin outline → placeholder bucket
- [ ] Tests with PL hybrid-war style fixtures

### Task 3: LLM topic fill (when &lt; 6 topics)

**Files:**
- Modify: `lib/harvestAiCoverage.ts`
- Reuse DeepSeek judge/client pattern from existing coverage code (smallest existing helper)
- Test: mock LLM; assert titles added to reach ≥ 6 when enough questions exist

- [ ] `fillTopicsWithLlm(keyword, questions, existingTitles)` 
- [ ] Skip LLM if already ≥ 6 topics or &lt; 9 questions total
- [ ] Jest with mock

### Task 4: `harvestAiCoverage` orchestration

**Files:**
- Modify: `lib/harvestAiCoverage.ts`
- Call: `fetchLlmCoverageQuestions`, merge PAA as `ai_overview` / reddit
- Test: orchestration with mocked fetch

- [ ] Merge + dedupe questions
- [ ] Cluster + budget
- [ ] Return `flatQuestions`, `topics`, `stats.bySource`
- [ ] Log-friendly stats object

### Task 5: Wire deep-analysis

**Files:**
- Modify: `pages/api/articles/deep-analysis.ts` (coverage block ~930+)
- Pass outline titles from `competitor_outlines_cache` / early outline payload
- Remove / demote template fallback to `questionCount < 6` only

- [ ] Call `harvestAiCoverage` before `buildGradedCoverageSnapshot`
- [ ] Pass `harvested.flatQuestions` as `llmQuestions`
- [ ] Console log harvest stats
- [ ] Keep org token budget skip

### Task 6: Snapshot topic metadata (optional but preferred)

**Files:**
- Modify: `lib/coverageStore.ts` / snapshot type if needed
- Modify: `lib/infoToCoverTopics.ts` to prefer `opts.harvestedTopics` or snapshot.topics

- [ ] Persist topic titles + item id lists when building snapshot
- [ ] UI groups by harvested titles; icons unchanged
- [ ] Backward compatible when field absent

### Task 7: Verify

- [ ] Jest: harvest + infoToCover + curate suites
- [ ] Manual: deep analysis on `wojna hybrydowa` — expect ≥ 6 topics, multi-engine icons
- [ ] `graphify update .`

---

## File map

| File | Role |
|------|------|
| `lib/harvestAiCoverage.ts` | Harvest orchestration, cluster, budget |
| `lib/llmCoverageQuestions.ts` | Unchanged contract (reuse) |
| `pages/api/articles/deep-analysis.ts` | Wire harvest; demote templates |
| `lib/infoToCoverTopics.ts` | Prefer harvested topic titles |
| `lib/coverageStore.ts` / `aiCoverage` types | Optional topics on snapshot |
| `__tests__/lib/harvestAiCoverage.test.ts` | Unit tests |

## Out of scope

- Phase C Surfy highlight
- Claude / Facebook sources
- Sidecar Python rewrite of DFS
