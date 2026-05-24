# X-Algorithm Scoring Pipeline

**Date:** 2026-05-24
**Branch:** `codex/auth`
**Status:** draft

## Overview

Rebuild the content analysis pipeline using patterns from X's "For You" feed algorithm. Four independent subsystems that together replace TF-IDF term extraction, naive audit scoring, and the hardcoded deep-analysis SSE pipeline with an event-driven architecture, semantic term extraction, content classification, and multi-signal ranking prediction.

**No frontend changes.** Existing score displays continue to work — only the number source changes. The pipeline writes `ranking_score` to the `articles` table. Frontend reads the same field it reads today, but the value is now AI-predicted instead of rule-computed.

## Architecture

```
TypeScript API                    Python sidecar
┌──────────────────┐    POST     ┌─────────────────────────┐
│ POST /api/       │───────────▶│ POST /pipeline/         │
│ articles/        │            │ deep-analysis           │
│ deep-analysis    │            │                         │
│                  │            │  1. Lock + read job     │
│  1. INSERT job   │            │  2. Run 5-stage pipe    │
│     → analysis_  │◀───────────│  3. Write progress/     │
│     jobs table   │   polls DB │     result back to DB   │
│                  │  (500ms)   │                         │
│  2. Start SSE    │            └─────────────────────────┘
│     stream       │
│  3. Poll job     │
│     progress     │
│     from DB      │
└──────────────────┘
```

- **Trigger**: TypeScript `POST`s to Python sidecar `/pipeline/deep-analysis` with `{jobId}`. Python locks the job row, reads payload from DB, executes pipeline, writes progress/result back, unlocks on completion.
- **Progress**: Python writes `current_stage`, `stage_progress`, `total_progress`, and `progress_message` to `analysis_jobs`. TypeScript polls the row every 500ms and streams only changed fields via SSE.
- **Completion**: Python writes `status='done'` + `result` JSONB. TypeScript detects it in poll, sends final SSE event, closes stream.
- **Zero new infrastructure** — one new PostgreSQL table.

## 1. Event-Driven Pipeline

### New table: `analysis_jobs`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK DEFAULT gen_random_uuid() | Job identifier |
| article_id | INT NOT NULL | FK to articles |
| job_type | TEXT NOT NULL | `deep_analysis`, `content_classify`, `ranking_score` |
| status | TEXT NOT NULL DEFAULT 'queued' | `queued` → `running` → `done` \| `failed` |
| current_stage | TEXT | Stage name (e.g., `fetching`, `classifying`, `scoring`) |
| stage_progress | INT DEFAULT 0 | 0-100 within current stage |
| total_progress | INT DEFAULT 0 | 0-100 across entire pipeline |
| progress_message | TEXT | Human-readable progress (e.g., "Scraping 3/5 competitors…") |
| payload | JSONB | Input data (url, keyword, html, competitor data) |
| result | JSONB | Pipeline output (ranking_score, signals, terms, class) |
| error | TEXT | Error message if failed |
| locked_at | TIMESTAMPTZ | When a worker claimed this job |
| locked_by | TEXT | Worker identifier (hostname or pid) |
| attempts | INT DEFAULT 0 | Number of execution attempts |
| max_attempts | INT DEFAULT 3 | Max retries before giving up |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

### Job locking (PostgreSQL advisory)

Worker claims a job with atomic lock to prevent double execution, even if multiple workers run:

```sql
WITH next_job AS (
  SELECT id FROM analysis_jobs
  WHERE status = 'queued'
    AND (locked_at IS NULL OR locked_at < now() - INTERVAL '5 minutes')
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE analysis_jobs
SET status = 'running',
    locked_at = now(),
    locked_by = '{worker_id}',
    attempts = attempts + 1
FROM next_job
WHERE analysis_jobs.id = next_job.id
RETURNING analysis_jobs.*;
```

Failed jobs are retried up to `max_attempts` times. Jobs locked for > 5 minutes are considered stale and re-queued.

### SSE polling (TypeScript → frontend)

```typescript
// Poll every 500ms, only emit when fields change
let prevStage = '';
let prevTotal = -1;
const poll = setInterval(async () => {
  const job = await db.query('SELECT * FROM analysis_jobs WHERE id = $1', [jobId]);

  if (job.current_stage !== prevStage) {
    res.write(`data: ${JSON.stringify({
      type: 'stage', stage: job.current_stage,
      stageProgress: job.stage_progress,
      totalProgress: job.total_progress,
      message: job.progress_message,
    })}\n\n`);
    prevStage = job.current_stage;
  } else if (job.total_progress !== prevTotal) {
    res.write(`data: ${JSON.stringify({
      type: 'progress', totalProgress: job.total_progress,
      stageProgress: job.stage_progress,
      message: job.progress_message,
    })}\n\n`);
    prevTotal = job.total_progress;
  }

  if (job.status === 'done') {
    res.write(`data: ${JSON.stringify({ type: 'result', result: job.result })}\n\n`);
    clearInterval(poll);
  }
  if (job.status === 'failed') {
    res.write(`data: ${JSON.stringify({ type: 'error', error: job.error })}\n\n`);
    clearInterval(poll);
  }
}, 500);
```

### Stage contract

```python
class AnalysisStage:
    name: str
    progress_weight: float  # 0.0-1.0 (fraction of total pipeline)

    async def run(self, ctx: StageContext) -> dict:
        """Execute stage. Input from previous stage output or payload.
        Emit progress via ctx.emit_progress()."""
        ...

    def can_skip(self, ctx: StageContext) -> bool:
        """Optional. Return True to skip this stage (e.g., cached data)."""
        return False

class StageContext:
    job_id: str
    total_progress: float  # accumulated progress before this stage

    async def emit_progress(self, stage_percent: float, message: str):
        """Updates DB with current stage progress + total progress.
        total = self.total_progress + stage_percent * stage.progress_weight * 100"""
        ...

    def get_state(self, key: str) -> Any: ...
    async def set_state(self, key: str, value: Any): ...
```

### Pipeline runner

```python
class PipelineRunner:
    def __init__(self, stages: list[AnalysisStage], ctx: StageContext):
        ...

    async def run(self) -> dict:
        result = {}
        for stage in self.stages:
            if stage.can_skip(ctx):
                continue
            await ctx.set_state("current_stage", stage.name)
            await ctx.emit_progress(0, f"{stage.name} started")
            try:
                result = await stage.run(ctx)
            except Exception as exc:
                await ctx.mark_failed(str(exc))
                raise
            ctx.total_progress += stage.progress_weight * 100
            await ctx.emit_progress(100, f"{stage.name} done")
        return result
```

Stage execution is sequential (each depends on previous). Individual stages parallelize internally where possible (competitor scraping, chunk extraction) with concurrency limits.

### Deep analysis pipeline (5 stages)

| # | Stage | Weight | Module | Description |
|---|-------|--------|--------|-------------|
| 1 | FetchPage | 0.15 | Existing fetch logic | Plain HTTP → SPA fallback → cheerio parse |
| 2 | ScrapeSerp | 0.25 | `serp_analyzer.py` | Serper search + competitor scraping (parallel) + outlines |
| 3 | ClassifyContent | 0.15 | `content_classifier.py` | **New** — Grox-like 5-dimension classification |
| 4 | ExtractTerms | 0.20 | `semantic_terms.py` | **New** — Semantic term extraction via DeepSeek |
| 5 | ScoreRanking | 0.25 | `ranking_scorer.py` | **New** — Multi-signal ranking prediction |

## 2. Semantic Term Extraction

Replaces `_extract_nlp_terms()` in `serp_analyzer.py`.

**Module:** `python-sidecar/analyzers/semantic_terms.py`

### Algorithm

1. **Chunk** — split each competitor page text by h2/h3 headings into chunks (max 3000 chars each)
2. **Check cache** — compute content hash per chunk: `hash(keyword + url + first_100_chars)`. Skip chunks with cached results.
3. **Extract (parallel, concurrency-limited)** — For uncached chunks, call DeepSeek with extraction prompt. Limited to 5 concurrent requests via `asyncio.Semaphore(5)`.
4. **Aggregate** — collect all terms across all chunks (cached + fresh). For each unique term: `doc_freq` (pages containing it), average `relevance` (0-1), average occurrence count per page, type classification.
5. **Filter** — `min_docs = max(1, ceil(0.3 * competitor_count))` for competitor_count ≤ 3, otherwise `max(2, ceil(0.3 * competitor_count))`. Remove stopwords and generic terms. Classify each term as `core`, `supporting`, `entity`, or `question`.
6. **Return** top 50 as `[{term, target_count, type}]` — `type` is new but backwards-compatible (consumers ignore unknown fields).

### DeepSeek prompt

```
You are an SEO analyzer. Given text from a top-ranking page for the keyword
"{keyword}", extract distinctive SEO-relevant terms and phrases (1-4 words)
that characterize what makes this content rank well.

Return ONLY: [{"term": "phrase here", "relevance": 0.95, "type": "type"}, ...]

Rules:
- relevance = how strongly this term defines the topic (0.0-1.0)
- type = "core" (primary topic), "supporting" (secondary), "entity" (named entity), or "question" (implicit question)
- Include multi-word phrases (e.g., "keyword research tools")
- Skip generic terms ("article", "information", "website")
- Skip the keyword itself if it appears
- Return 10-20 terms max
```

### Target count computation

- If raw occurrence counts available from chunk aggregation: `target_count = round(avg_occurrences_per_page)`
- Otherwise: `target_count = max(1, round(doc_freq * avg_relevance * 3))`

### Caching

```python
# In-memory LRU cache, max 500 entries
_cache: dict[str, list[dict]] = {}

def _cache_key(keyword: str, chunk_hash: str) -> str:
    return f"{keyword}::{chunk_hash}"
```

### Changes in serp_analyzer.py

```python
# Before:
nlp_terms = _extract_nlp_terms(serp_texts, keyword)

# After:
from analyzers.semantic_terms import extract_semantic_terms
nlp_terms = await extract_semantic_terms(keyword, serp_texts, deepseek_key)
```

Rest of `serp_analyzer.py` unchanged — `_compute_targets()`, competitor data fetching, outlines extraction all stay as-is.

## 3. Content Classifier (Grox-like)

**Module:** `python-sidecar/analyzers/content_classifier.py`

Single DeepSeek call classifies all 5 dimensions simultaneously. Pre-LLM extraction handles cheap signals (word count, regex author/date parse, schema detection). LLM handles semantic signals (page type, content originality, E-E-A-T quality, freshness).

### Output

```python
{
    "page_type": "article",           # article|product|landing_page|blog_listing|documentation|unknown
    "page_type_confidence": 0.92,     # 0-1
    "is_thin": False,                 # word count < 300 or blocked
    "thin_reason": None,              # word_count<300|cookie_wall|paywall|js_shell
    "word_count_estimate": 2100,
    "has_author": True,               # author byline/bio detected
    "has_date": True,                 # publication date detected
    "has_sources": True,              # external citations present
    "eeat_score": 72,                 # 0-100 overall E-E-A-T
    "content_originality_risk": "low", # low|medium|high — softer than "AI-generated: true/false"
    "is_evergreen": True,             # topic not time-sensitive
    "freshness_score": 68             # 0-100
}
```

### On AI detection

`content_originality_risk` replaces `is_ai_generated` / `ai_confidence`. It is treated as a **soft signal** — it informs the E-E-A-T assessment but does not independently penalize ranking. False positives on AI detection are common and must not break scoring. The risk level feeds into the scoring prompt as context, not as a hard deduction.

### Pre-LLM extraction (no API cost)

- `word_count` — BeautifulSoup text extraction
- `has_author` — regex for author patterns (`<meta name="author">`, `rel="author"`, `.byline`, `class="author"`)
- `has_date` — regex for dates (`<time>`, `pubdate`, `datePublished`, ISO dates in text)
- `has_schema_article` — JSON-LD `@type: Article` or `NewsArticle`
- Title, first 15 headings (h1-h3), 2000-char body sample, meta description

### DeepSeek prompt

```
Analyze this webpage content for SEO quality. Return JSON:
{
  "page_type": "article|product|landing_page|blog_listing|documentation|unknown",
  "page_type_confidence": 0.0-1.0,
  "is_thin": true/false,
  "thin_reason": null|"word_count<300"|"cookie_wall"|"paywall"|"js_shell",
  "eeat_score": 0-100,
  "content_originality_risk": "low|medium|high",
  "is_evergreen": true/false,
  "freshness_score": 0-100
}

CONTENT:
Title: {title}
Headings: {headings[:15]}
Body sample: {body[:2000]}
Meta description: {meta_desc}
Pre-extracted: word_count={word_count}, has_author={has_author}, has_date={has_date}
```

~400 input tokens, ~200 output tokens per call.

## 4. Multi-Signal Ranking Score

Builds on — does not delete — `_compute_audit_score()` from `site_analyzer.py`. The legacy score is preserved as `audit_score_legacy` during validation. After Phase 4 confirms AI scoring is stable, the legacy function can be removed (future cleanup).

**Module:** `python-sidecar/analyzers/ranking_scorer.py`

### Hybrid scoring approach

LLM predictions can drift (same input → 67 one day, 74 the next). To stabilize:

```
final_score = round(0.7 * rule_base + 0.3 * llm_adjustment)
```

Where:
- `rule_base` = existing `content_score` from `contentScore.ts` (deterministic rule engine)
- `llm_adjustment` = AI's holistic judgment incorporating E-E-A-T, freshness, competitiveness that rules can't measure

The 70/30 split ensures stability while still letting AI drag down a thin page or boost a strong one. Over time, as prompts stabilize and outputs become consistent, the split can shift toward more AI weight.

### Input signals

| Signal | Source | What it measures |
|--------|--------|------------------|
| meta_quality | site_analyzer meta audit | Title, description, OG, canonical quality |
| content_depth | word count, headings, paragraphs vs competitor targets | Does content match what top pages have? |
| eeat | ContentClass + author/date/sources/schema | Authority and trust signals |
| freshness | ContentClass | Is content current or stale? |
| technical | site_analyzer issues list | Viewport, image alt, heading hierarchy |
| competitiveness | serp_analyzer competitor averages | How far behind/ahead of competing pages? |

### DeepSeek prompt

```
You are an SEO ranking analyst. Using the provided numeric rubric, predict
how likely this page is to rank in Google top 10 for "{keyword}".
Rate each signal 0-100 with verdict. Do not reward vague quality.
Use the exact numbers provided in the input data where relevant.

Return JSON:
{
  "total": 0-100,
  "signals": [
    {"name": "meta_quality", "score": 72, "verdict": "adequate|strong|needs_work|weak", "recommendation": "..."},
    {"name": "content_depth", "score": 0-100, "verdict": "...", "recommendation": "..."},
    {"name": "eeat", "score": 0-100, "verdict": "...", "recommendation": "..."},
    {"name": "freshness", "score": 0-100, "verdict": "...", "recommendation": "..."},
    {"name": "technical", "score": 0-100, "verdict": "...", "recommendation": "..."},
    {"name": "competitiveness", "score": 0-100, "verdict": "...", "recommendation": "..."}
  ],
  "summary": "one-sentence verdict"
}

Scoring rubric (MUST follow exactly):
- 10-30: Thin content, missing E-E-A-T, poor meta, clear AI-generated
- 31-50: Some content but below competitors, basic SEO issues
- 51-70: Adequate content, some authority, decent optimization
- 71-85: Competitive depth, good E-E-A-T, clean technical SEO
- 86-95: Comprehensive, strong authority, fully optimized, fresh content

Decisive signals (E-E-A-T missing, thin content) drag total down significantly.
Strong content depth alone does NOT compensate for missing authority.

INPUT DATA:
Keyword: {keyword}
Content score (rule-based): {content_score}/100
Competitor averages: words={words_target}, headings={headings_target}, paragraphs={paragraphs_target}
Meta: title={title} ({title_length} chars), desc={desc} ({desc_length} chars), OG={og_tags}, canonical={canonical}
Content stats: {word_count} words, {heading_count} headings, {paragraph_count} paragraphs
Content class: page_type={page_type}, thin={is_thin}, eeat={eeat_score}, originality={content_originality_risk}, freshness={freshness_score}
Issues: {issues_json}
```

~600 input tokens, ~400 output tokens.

### Storage

| Column | Type | Existing/New | Purpose |
|--------|------|--------------|---------|
| content_score | INT | Existing | Rule-based score from `contentScore.ts` |
| audit_score_legacy | INT | Existing | Old `_compute_audit_score()` result — keep until Phase 4 validates AI scoring |
| ranking_score | INT | **New** | AI-predicted score from pipeline (`final_score` after 70/30 hybrid) |
| ranking_signals | JSONB | **New** | Signal breakdown + version metadata |

`audit_score_legacy` is the existing `score` column in articles — renamed for clarity, kept for comparison during validation.

### ranking_signals structure

```json
{
  "version": "ranking_scorer_v1",
  "model": "deepseek-v4-pro",
  "prompt_version": "2026-05-24",
  "input_hash": "sha256 of all input data",
  "scored_at": "2026-05-24T14:30:00Z",
  "rule_base": 78,
  "llm_total": 64,
  "final_score": 74,
  "signals": [
    {"name": "meta_quality", "score": 72, "verdict": "adequate", "recommendation": null},
    {"name": "content_depth", "score": 85, "verdict": "strong", "recommendation": null},
    {"name": "eeat", "score": 42, "verdict": "needs_work", "recommendation": "Add author bio and external sources"},
    {"name": "freshness", "score": 60, "verdict": "adequate", "recommendation": null},
    {"name": "technical", "score": 55, "verdict": "needs_work", "recommendation": "Fix missing image alt text"},
    {"name": "competitiveness", "score": 70, "verdict": "adequate", "recommendation": null}
  ],
  "summary": "Content depth is strong but E-E-A-T signals are weak — add author bio and external sources."
}
```

Versioning ensures full traceability: given the same `input_hash`, the same `prompt_version` and `model` should produce consistent results. This is critical for debugging score changes.

### Site analyzer changes

- `_compute_audit_score()` stays — result saved as `audit_score_legacy`
- `analyze_site()` continues returning its `score` field (legacy)
- New `ranking_score` written by pipeline alongside legacy
- After Phase 4 validation: legacy score deprecated (not removed, just no longer displayed)
- `issue_count`, `issue_count_error`, `issue_count_warning` — preserved unchanged

## Migration

### DB migration (Phase 1)
```sql
ALTER TABLE articles ADD COLUMN ranking_score INT;
ALTER TABLE articles ADD COLUMN ranking_signals JSONB;
CREATE TABLE analysis_jobs (...);
```

### Backward compatibility
- Articles without `ranking_score` (NULL) → frontend reads `content_score` (existing behavior)
- New articles analyzed through pipeline → `ranking_score` is set → frontend reads it
- Legacy `_compute_audit_score` result preserved in existing `score` column (not renamed until validation passes)
- No data migration needed — old articles optionally re-analyzed in Phase 4

### Rollback
- Remove `ranking_score` and `ranking_signals` columns
- Remove `analysis_jobs` table
- Pipeline endpoint removed — existing `deep-analysis.ts` handler continues to work
- Zero impact on existing data

## Build order

```
Phase 1: Pipeline infrastructure + DB schema
  1a. ALTER TABLE articles ADD ranking_score, ranking_signals
  1b. CREATE TABLE analysis_jobs (with locking fields)
  1c. Implement StageContext + PipelineRunner in Python
  1d. Add POST /pipeline/deep-analysis endpoint in Python sidecar
  1e. Refactor deep-analysis.ts to post job + poll + SSE stream
  1f. End-to-end test with mock stages returning fixed data

Phase 2: Mock stages → verify end-to-end flow
  2a. Implement mock ClassifyContent stage (returns hardcoded data)
  2b. Implement mock ExtractTerms stage (returns hardcoded terms)
  2c. Verify full job lifecycle: create → lock → run → progress SSE → done → result stored

Phase 3: Real stages (parallel)
  3a. Implement content_classifier.py with real DeepSeek prompt
  3b. Implement semantic_terms.py with cache + semaphore + real DeepSeek
  3c. Wire both as real pipeline stages, replacing mocks

Phase 4: Ranking Score
  4a. Implement ranking_scorer.py with hybrid 70/30 approach
  4b. Wire as final pipeline stage
  4c. Store results with version metadata (model, prompt_version, input_hash)

Phase 5: Validate
  5a. Compare rule-base vs llm_total vs final_score on 20+ existing articles
  5b. Check score stability (re-analyze same article 3x, verify ≤5 point variance)
  5c. Adjust prompts if needed
  5d. Backfill ranking_score for existing articles (optional batch job)
  5e. After validation: switch frontend to prefer ranking_score over content_score
```

## Non-goals

- No UI redesign (same score display, same dashboard views)
- No new Python dependencies (DeepSeek API over `httpx`, already installed)
- No changes to `contentScore.ts` (rule-based scoring stays as-is)
- No changes to frontend components
- No new infrastructure (PostgreSQL queue, no Redis/Kafka)
- No deletion of `_compute_audit_score()` until Phase 5 confirms AI scoring is stable
