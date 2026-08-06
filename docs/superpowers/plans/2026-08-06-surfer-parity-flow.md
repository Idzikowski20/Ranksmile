# Surfer-parity flow: outline → article → scoring

Consolidated from a 2026-08-06 audit of SurferSEO's client-visible contract (GraphQL
documents extracted from their app bundle + a HAR of one session) plus our own code.
Only protocol shapes, entity names and UX patterns were taken. No competitor code,
schema or prompt text is copied into this repo.

## 1. What they run

- **Elixir/Phoenix + Absinthe GraphQL.** One `/graphql` endpoint, one WebSocket
  (`__absinthe__:control`, `phx_join` → `doc` → `auth_result`), plus an SSE endpoint
  `/fact-detection/stream/<Phoenix token>`.
- Client surface: 185 queries, 184 mutations, **71 subscriptions**, 223 fragments.
- **No polling anywhere.** Every live surface is a subscription on the single socket.

### Article model (the important one)

```graphql
fragment AiArticleFields on Article {
  id content status pipelineVersion tones experiments
  manualOutline draftId outlineMd
  outline {
    title
    level
    knowledgeBase { text sources { url citation } }
  }
}
```

Each outline heading carries its own knowledge base — facts with source URL and
citation — assembled **before** writing. Statuses: `NEW → WAITING_FOR_USER_INPUT →
WRITING → COMPLETED`.

### Analysis progress model

```graphql
progress {
  importingContent   { status }
  fetchingSerp       { status error }
  crawlingSerp       { finished total status }
  loadingCompetitors { status error }
}
```

Typed phases, each with its own status and error; `finished/total` drives
"Crawling result 6/10". Per-page event: `SerpAnalyzerPageCrawled(queryId) { crawledPageId }`.

### Generation flow

```
RequestHeadings ──► GeneratedHeadings (sub)          outline
SubmitAiArticleOutlineMd(outlineMd)                  user approves
WriteAiArticle ──► AiArticleStatusStreaming (sub)    status line
               └─► AiArticleContentStreaming (sub)   text streams in
```

### Scoring

```
AioScore { status value errorReason factors[] }
  FactsCoverageFactor { name: FACTS_COVERAGE, value: 82 }
  IntroductionFactor  { name, found, score: 0.0–1.0, textSpan }
    INTRODUCTION_COVERED_TOPICS
    INTRODUCTION_TARGET_AUDIENCE
    INTRODUCTION_EARLY_QUERY_ANSWER
    INTRODUCTION_TOPIC_RELEVANCE
```

Four of five factors judge the introduction only, each returning the exact sentence
that earned the score. Weights are server-side (`AioScoreWeights`).

## 2. Gap table

| Area | Surfer | Ranksmile today | Action |
|---|---|---|---|
| Facts in outline | `knowledgeBase { text sources }` per heading | data exists in `ExecutionPlanSection.claims[].sources`, never rendered | **P1** |
| Section bridges | explicit "bridge to next section" bullet | `writerHints.transition` exists, not rendered | **P1** |
| Block detail | "table comparing X: criteria a, b, c" | `requiredBlocks` without axes | **P1** |
| Analysis progress | typed phases + `finished/total` | one free-text `progress_message` | **P2** |
| Per-page crawl | `SerpAnalyzerPageCrawled` | none | **P2** |
| Writing feedback | 2 streams (status + content) | polling, text appears at the end | **P3** |
| Article scoring | typed factors + `textSpan` | one AI number | **P4** |
| Pipeline versioning | `pipelineVersion`, `experiments`, `manualOutline` | none | **P5** |
| Internal links | match → insert → **review** | prompt-time insert + allowlist filter | P6 (later) |
| Humanizer | `DetectAi`, `HumanizeText` | none | out of scope |

Where we are already ahead, and keep it: our Plan Validator gates knowledge coverage
≥95 % per claim and per question **before** writing, and the compiled write plan holds
per-section budgets. Surfer submits an outline and lets the server write, then scores
afterwards.

## 3. Phases

### P1 — Outline carries its evidence (this commit)

`reviewOutlineFromBundle` renders, per section: objective, the claims with their
sources, must-answer questions, required blocks with their evidence hints, freshness
notes, and the bridge to the next section. `collectApprovedOutline` must round-trip
whatever it renders, so a reviewer can edit or delete any of it.

Verify: unit tests for render + round-trip.

### P2 — Structured analysis progress + right-hand panel

1. `analysis_jobs` gains a nullable `progress_json` column (idempotent `ADD COLUMN`,
   Postgres path uses `IF NOT EXISTS`).
2. `job-progress` POST accepts `phases: { importingContent, fetchingSerp, crawlingSerp:
   {finished,total}, loadingCompetitors }` and stores it; GET returns it.
3. Sidecar `PipelineRunner` emits phase objects; `scrape_serp` emits `finished/total`
   per crawled result plus the URL, so the panel can show "Crawling result 6/10 ·
   pl.wikipedia.org".
4. `AnalysisProgressPanel` renders the two groups (AI Search, Google Search results)
   from those phases: ✓ / spinner / pending.

Verify: pure `analysisPhaseRows()` unit-tested; panel screenshot.

### P3 — Streaming generation

Reuse the SSE pattern already used by `optimize-sections`: one endpoint streams status
events, one streams content chunks, both keyed by job id. Editor renders the status
line in the document area and appends content as it lands. Drop the polling loop.

### P4 — Typed article scoring

`aiSearchScore` returns factors instead of one number:
`{ name, found, score, textSpan }` for introduction factors plus a facts-coverage
value. Weights live in config, not in the formula. The editor lists each factor with
the sentence that satisfied it.

### P5 — Pipeline versioning

`articles.pipeline_version` + `manual_outline` flag, written at generation time, so a
prompt change can be measured against outcomes later.

## 4. Rules for this work

- Ship one phase per commit, each with its own check.
- Never loosen the Plan Validator gates to make a phase pass.
- Copy patterns and contracts, never their code, schema text or prompts.
