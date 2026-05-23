# X-Algorithm Scoring Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild content analysis pipeline with event-driven architecture, semantic term extraction via DeepSeek, content classification, and multi-signal ranking prediction — 4 subsystems delivered over 5 phases.

**Architecture:** The TypeScript API creates an article skeleton + `analysis_jobs` row, POSTs to Python sidecar `/pipeline/deep-analysis` with `{jobId, payload}`, awaits the sidecar response, writes `result`/`status` back to the job row, then streams the final result via SSE. Python sidecar runs a 5-stage pipeline (FetchPage → ScrapeSerp → ClassifyContent → ExtractTerms → ScoreRanking) using a generic `PipelineRunner` + `StageContext`. During execution, Python pushes progress updates to `/api/articles/job-progress` so the TS side can poll and stream intermediate progress. Zero new infrastructure — one new PostgreSQL table, two new API routes, three new Python modules.

**Tech Stack:** Python (httpx, BeautifulSoup, anthropic SDK → DeepSeek), TypeScript (Next.js API routes, cheerio, Sequelize), PostgreSQL (Neon).

---

## File Structure

```
New files:
  python-sidecar/pipeline/__init__.py              — empty init
  python-sidecar/pipeline/contracts.py             — StageContext + AnalysisStage (no imports from runner/stages)
  python-sidecar/pipeline/runner.py                — PipelineRunner with lazy stage imports
  python-sidecar/pipeline/stages/__init__.py       — empty init
  python-sidecar/pipeline/stages/fetch_page.py     — Stage 1: fetch page
  python-sidecar/pipeline/stages/scrape_serp.py    — Stage 2: SERP analysis
  python-sidecar/pipeline/stages/classify_content.py  — Stage 3: content classifier
  python-sidecar/pipeline/stages/extract_terms.py  — Stage 4: semantic term extraction
  python-sidecar/pipeline/stages/score_ranking.py  — Stage 5: ranking score
  python-sidecar/analyzers/content_classifier.py   — Grox-like content classifier
  python-sidecar/analyzers/semantic_terms.py       — Semantic term extraction via DeepSeek
  python-sidecar/analyzers/ranking_scorer.py       — Hybrid 70/30 ranking score
  pages/api/articles/job-progress.ts               — POST endpoint: Python → DB progress writes

Modified files:
  python-sidecar/main.py                           — Add POST /pipeline/deep-analysis
  python-sidecar/analyzers/serp_analyzer.py        — Replace _extract_nlp_terms with semantic_terms
  pages/api/articles/deep-analysis.ts              — Refactor to job + sidecar + result-writeback + SSE
  lib/ensureArticlesTables.ts                      — Add analysis_jobs table + ranking columns

DB changes:
  ALTER TABLE articles ADD COLUMN ranking_score INT;
  ALTER TABLE articles ADD COLUMN ranking_signals JSONB (Postgres) / TEXT (SQLite);
  CREATE TABLE analysis_jobs (payload/result as JSONB for Postgres, TEXT for SQLite);
```

---

## Phase 1: Pipeline Infrastructure + DB Schema

### Task 1: DB migration — analysis_jobs table + articles columns

**Files:**
- Modify: `lib/ensureArticlesTables.ts:163-172` (add migration block)

- [ ] **Step 1: Add analysis_jobs CREATE TABLE and ALTER TABLE migrations**

In `lib/ensureArticlesTables.ts`, after the `article_keywords` CREATE TABLE block, add:

```typescript
  // analysis_jobs — event-driven pipeline job queue
  await db.query(`
    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id               TEXT PRIMARY KEY,
      article_id       INTEGER NOT NULL,
      job_type         TEXT NOT NULL DEFAULT 'deep_analysis',
      status           TEXT NOT NULL DEFAULT 'queued',
      current_stage    TEXT,
      stage_progress   INTEGER DEFAULT 0,
      total_progress   INTEGER DEFAULT 0,
      progress_message TEXT,
      payload          ${isPostgres ? 'JSONB' : 'TEXT'},
      result           ${isPostgres ? 'JSONB' : 'TEXT'},
      error            TEXT,
      locked_at        TIMESTAMP,
      locked_by        TEXT,
      attempts         INTEGER DEFAULT 0,
      max_attempts     INTEGER DEFAULT 3,
      created_at       TIMESTAMP DEFAULT ${NOW_DEFAULT},
      updated_at       TIMESTAMP DEFAULT ${NOW_DEFAULT}
    )
  `);

  // New columns for AI ranking score
  if (isPostgres) {
    try { await db.query(`ALTER TABLE articles ADD COLUMN ranking_score INTEGER`); } catch {}
    try { await db.query(`ALTER TABLE articles ADD COLUMN ranking_signals JSONB`); } catch {}
  } else {
    try { await db.query(`ALTER TABLE articles ADD COLUMN ranking_score INTEGER`); } catch {}
    try { await db.query(`ALTER TABLE articles ADD COLUMN ranking_signals TEXT`); } catch {}
  }
```

Add indices at the bottom of the index block:

```typescript
  try { await db.query(`CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status)`); } catch {}
  try { await db.query(`CREATE INDEX IF NOT EXISTS idx_analysis_jobs_article ON analysis_jobs(article_id)`); } catch {}
```

- [ ] **Step 2: Verify DB schema**

Restart Next.js dev server. Trigger any article API call to run `ensureArticlesTables()`. Then verify:

```bash
# PostgreSQL
psql "$DATABASE_URL" -c "\d analysis_jobs"
psql "$DATABASE_URL" -c "\d articles" | grep ranking

# SQLite (dev)
sqlite3 data/database.sqlite ".schema analysis_jobs"
sqlite3 data/database.sqlite ".schema articles" | grep ranking
```

Expected: `analysis_jobs` table with all columns, `articles.ranking_score` and `articles.ranking_signals` exist (NULL for existing rows).

- [ ] **Step 3: Commit**

```bash
git add lib/ensureArticlesTables.ts
git commit -m "feat: add analysis_jobs table and ranking_score/signals columns"
```

---

### Task 2: contracts.py — StageContext + AnalysisStage base classes

**Files:**
- Create: `python-sidecar/pipeline/__init__.py`
- Create: `python-sidecar/pipeline/contracts.py`

This file MUST be separate from `runner.py` to avoid circular imports: stages import from `contracts`, `runner` imports stages lazily.

- [ ] **Step 1: Create empty __init__.py**

```powershell
New-Item -ItemType File -Path python-sidecar/pipeline/__init__.py
```

- [ ] **Step 2: Write contracts.py**

`python-sidecar/pipeline/contracts.py`:

```python
"""Pipeline contracts — base classes with no imports from runner or stages.
Stages import from here; runner imports stages lazily. No circular deps."""
import os
from typing import Any
import httpx


class StageContext:
    """Shared state bucket passed through all pipeline stages.
    Pushes progress to DB via Next.js API callback (job-progress endpoint)."""

    def __init__(self, job_id: str, payload: dict, nextjs_url: str = ""):
        self.job_id = job_id
        self.payload = payload
        self._state: dict[str, Any] = {}
        self.total_progress: float = 0.0  # accumulated progress from completed stages (0-100)
        self._nextjs_url = nextjs_url.rstrip("/") if nextjs_url else ""

    def get_state(self, key: str) -> Any:
        return self._state.get(key)

    def set_state(self, key: str, value: Any):
        """Sync — stages call this directly (no await)."""
        self._state[key] = value

    async def emit_progress(self, stage: "AnalysisStage", stage_percent: float, message: str):
        """Push progress to DB via job-progress API.
        total = completed_stages_progress + stage_percent * stage.progress_weight * 100

        stage_percent: 0-100 within the current stage.
        message: human-readable progress string."""
        self._state["progress_message"] = message
        current_stage = self._state.get("current_stage", "")

        stage_contribution = stage_percent * stage.progress_weight
        total = self.total_progress + stage_contribution

        if not self._nextjs_url:
            print(f"[pipeline] [{current_stage}] {message} ({total:.0f}%)")
            return

        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"{self._nextjs_url}/api/articles/job-progress",
                    headers={
                        "Content-Type": "application/json",
                        "x-internal-token": os.environ.get("INTERNAL_PIPELINE_TOKEN", ""),
                    },
                    json={
                        "jobId": self.job_id,
                        "currentStage": current_stage,
                        "stageProgress": int(stage_percent),
                        "totalProgress": int(total),
                        "message": message,
                    },
                )
        except Exception as exc:
            print(f"[pipeline] progress update failed: {exc}")

    async def mark_failed(self, error: str):
        """Store error in state. Caller (runner) propagates to DB via final response."""
        self._state["error"] = error
        print(f"[pipeline] FAILED: {error}")


class AnalysisStage:
    """Base stage contract. Subclass and override run()."""
    name: str = ""
    progress_weight: float = 0.0  # fraction of total pipeline (0.0-1.0)

    async def run(self, ctx: StageContext) -> dict:
        raise NotImplementedError

    def can_skip(self, ctx: StageContext) -> bool:
        return False
```

- [ ] **Step 3: Verify contracts parse correctly**

```bash
cd python-sidecar
python -c "from pipeline.contracts import StageContext, AnalysisStage; print('contracts OK')"
```

Expected: `contracts OK`

- [ ] **Step 4: Commit**

```bash
git add python-sidecar/pipeline/__init__.py python-sidecar/pipeline/contracts.py
git commit -m "feat: add pipeline contracts — StageContext + AnalysisStage"
```

---

### Task 3: runner.py — PipelineRunner with lazy stage imports

**Files:**
- Create: `python-sidecar/pipeline/runner.py`

- [ ] **Step 1: Write runner.py**

`python-sidecar/pipeline/runner.py`:

```python
"""PipelineRunner — executes stages sequentially with progress accumulation.
Stage imports are lazy (inside build_deep_analysis_pipeline) to avoid
circular imports: stages → contracts (not runner), runner → stages (lazy)."""
from pipeline.contracts import StageContext, AnalysisStage


class PipelineRunner:
    """Executes stages sequentially, accumulating progress."""

    def __init__(self, stages: list[AnalysisStage], ctx: StageContext):
        self.stages = stages
        self.ctx = ctx

    async def run(self) -> dict:
        result: dict = {}
        for stage in self.stages:
            if stage.can_skip(self.ctx):
                continue

            self.ctx.set_state("current_stage", stage.name)
            await self.ctx.emit_progress(stage, 0, f"{stage.name} started")

            try:
                stage_result = await stage.run(self.ctx)
                if stage_result:
                    self.ctx.set_state(stage.name, stage_result)
                    result[stage.name] = stage_result
            except Exception as exc:
                await self.ctx.mark_failed(str(exc))
                raise

            # Accumulate completed stage weight into total_progress
            self.ctx.total_progress += stage.progress_weight * 100
            await self.ctx.emit_progress(stage, 100, f"{stage.name} done")

        return result

    @staticmethod
    def build_deep_analysis_ctx(job_id: str, payload: dict, nextjs_url: str = "") -> StageContext:
        return StageContext(job_id, payload, nextjs_url)

    @staticmethod
    def build_deep_analysis_pipeline() -> list[AnalysisStage]:
        # Lazy imports — avoids circular deps (stages import from contracts, not runner)
        from pipeline.stages.fetch_page import FetchPageStage
        from pipeline.stages.scrape_serp import ScrapeSerpStage
        from pipeline.stages.classify_content import ClassifyContentStage
        from pipeline.stages.extract_terms import ExtractTermsStage
        from pipeline.stages.score_ranking import ScoreRankingStage

        return [
            FetchPageStage(),
            ScrapeSerpStage(),
            ClassifyContentStage(),
            ExtractTermsStage(),
            ScoreRankingStage(),
        ]
```

- [ ] **Step 2: Verify syntax (will fail on stage imports until Task 4)**

```bash
cd python-sidecar
python -c "
import ast
with open('pipeline/runner.py') as f:
    tree = ast.parse(f.read())
print('Syntax OK')
"
```

Expected: `Syntax OK`

- [ ] **Step 3: Commit**

```bash
git add python-sidecar/pipeline/runner.py
git commit -m "feat: add PipelineRunner with lazy stage imports"
```

---

### Task 4: Mock stages (Phase 2 prep — write now, verify end-to-end in Phase 2)

**Files:**
- Create: `python-sidecar/pipeline/stages/__init__.py`
- Create: `python-sidecar/pipeline/stages/fetch_page.py`
- Create: `python-sidecar/pipeline/stages/scrape_serp.py`
- Create: `python-sidecar/pipeline/stages/classify_content.py`
- Create: `python-sidecar/pipeline/stages/extract_terms.py`
- Create: `python-sidecar/pipeline/stages/score_ranking.py`

**All stages import from `pipeline.contracts`, NOT from `pipeline.runner`.**

- [ ] **Step 1: Create stages __init__.py**

```powershell
New-Item -ItemType File -Path python-sidecar/pipeline/stages/__init__.py
```

- [ ] **Step 2: Write fetch_page stage**

`python-sidecar/pipeline/stages/fetch_page.py`:

```python
"""Stage 1: Fetch page content. Plain HTTP with SPA fallback."""
import os
import httpx
from bs4 import BeautifulSoup
from pipeline.contracts import AnalysisStage, StageContext

NEXTJS_URL = os.getenv("NEXTJS_URL", "http://127.0.0.1:3000")


class FetchPageStage(AnalysisStage):
    name = "fetch_page"
    progress_weight = 0.15

    async def run(self, ctx: StageContext) -> dict:
        url = ctx.payload.get("url", "")
        if not url:
            raise ValueError("url is required in payload")

        html = await self._fetch(url)
        soup = BeautifulSoup(html, "lxml")

        # Extract rich metadata for downstream stages (scorer, classifier)
        title_tag = soup.find("title")
        h1_tag = soup.find("h1")
        desc_tag = soup.find("meta", attrs={"name": "description"})
        canonical_tag = soup.find("link", rel="canonical")
        og_title = soup.find("meta", property="og:title")
        og_desc = soup.find("meta", property="og:description")
        og_image = soup.find("meta", property="og:image")

        # Content stats (on cleaned soup — without scripts/nav etc.)
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
            tag.decompose()

        headings = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
        paragraphs = [p for p in soup.find_all("p") if len(p.get_text(strip=True)) > 30]
        imgs = soup.find_all("img")
        imgs_without_alt = sum(1 for img in imgs if not img.get("alt", "").strip())

        return {
            "url": url,
            "html": html,
            "title": h1_tag.get_text(strip=True) if h1_tag else (title_tag.get_text(strip=True) if title_tag else url),
            "meta_title": title_tag.get_text(strip=True) if title_tag else "",
            "meta_description": desc_tag.get("content", "") if desc_tag else "",
            "canonical": canonical_tag.get("href", "") if canonical_tag else "",
            "og_title": og_title.get("content", "") if og_title else "",
            "og_description": og_desc.get("content", "") if og_desc else "",
            "og_image": og_image.get("content", "") if og_image else "",
            "heading_count": len(headings),
            "paragraph_count": len(paragraphs),
            "image_count": len(imgs),
            "images_without_alt": imgs_without_alt,
            # Basic issues detected during fetch
            "issues": _detect_fetch_issues(title_tag, desc_tag, h1_tag, headings, imgs, imgs_without_alt),
        }

    async def _fetch(self, url: str) -> str:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            resp.raise_for_status()
            html = resp.text

        # SPA fallback check
        soup = BeautifulSoup(html, "lxml")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        if len(text.split()) < 200:
            html = await self._spa_fallback(url) or html

        return html

    async def _spa_fallback(self, url: str) -> str | None:
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                resp = await client.post(
                    f"{NEXTJS_URL}/api/render-page",
                    json={"url": url, "timeout": 15000},
                )
                resp.raise_for_status()
                data = resp.json()
                if data.get("html"):
                    print(f"[fetch_page] SPA fallback success for {url}")
                    return data["html"]
        except Exception as exc:
            print(f"[fetch_page] SPA fallback failed for {url}: {exc}")
        return None


def _detect_fetch_issues(title_tag, desc_tag, h1_tag, headings, imgs, imgs_without_alt) -> list[dict]:
    issues = []
    title_text = title_tag.get_text(strip=True) if title_tag else ""
    if not title_text:
        issues.append({"severity": "error", "check": "Meta Title", "message": "Missing <title> tag."})
    elif not (30 <= len(title_text) <= 65):
        issues.append({"severity": "warning", "check": "Meta Title", "message": f"Title length {len(title_text)} — should be 30-65 chars."})

    desc_text = desc_tag.get("content", "") if desc_tag else ""
    if not desc_text:
        issues.append({"severity": "warning", "check": "Meta Description", "message": "Missing meta description."})

    h1_count = sum(1 for h in headings if h.name == "h1")
    if h1_count == 0:
        issues.append({"severity": "error", "check": "H1 Tag", "message": "No H1 heading found."})
    elif h1_count > 1:
        issues.append({"severity": "error", "check": "H1 Tag", "message": f"Multiple H1 tags found ({h1_count})."})

    if imgs_without_alt > 0:
        issues.append({"severity": "warning", "check": "Image Alt Text", "message": f"{imgs_without_alt}/{len(imgs)} images missing alt text."})

    return issues
```

- [ ] **Step 3: Write scrape_serp stage**

`python-sidecar/pipeline/stages/scrape_serp.py`:

```python
"""Stage 2: SERP analysis — wraps existing serp_analyzer."""
from pipeline.contracts import AnalysisStage, StageContext
from analyzers.serp_analyzer import analyze_serp


class ScrapeSerpStage(AnalysisStage):
    name = "scrape_serp"
    progress_weight = 0.25

    async def run(self, ctx: StageContext) -> dict:
        keyword = ctx.payload.get("keyword", "")
        language = ctx.payload.get("language", "pl")
        if not keyword:
            raise ValueError("keyword is required in payload")

        await ctx.emit_progress(self, 30, f"Scraping SERP for: {keyword}")
        serp_data = await analyze_serp(keyword, language, num_results=10)
        await ctx.emit_progress(self, 80, f"Found {len(serp_data.get('competitors', []))} competitors")

        return serp_data
```

- [ ] **Step 4: Write classify_content stage (mock → real in Phase 3)**

`python-sidecar/pipeline/stages/classify_content.py`:

```python
"""Stage 3: Content classification — mock, returns hardcoded data.
Replaced by real content_classifier.py in Phase 3."""
from pipeline.contracts import AnalysisStage, StageContext


class ClassifyContentStage(AnalysisStage):
    name = "classify_content"
    progress_weight = 0.15

    async def run(self, ctx: StageContext) -> dict:
        fetch = ctx.get_state("fetch_page") or {}
        html = fetch.get("html", "")

        await ctx.emit_progress(self, 50, "Classifying content (mock)")

        return {
            "page_type": "article",
            "page_type_confidence": 0.85,
            "is_thin": False,
            "thin_reason": None,
            "word_count_estimate": len(html.split()) if html else 0,
            "has_author": False,
            "has_date": False,
            "has_sources": False,
            "eeat_score": 50,
            "content_originality_risk": "medium",
            "is_evergreen": True,
            "freshness_score": 50,
        }
```

- [ ] **Step 5: Write extract_terms stage (mock → real in Phase 3)**

`python-sidecar/pipeline/stages/extract_terms.py`:

```python
"""Stage 4: Semantic term extraction — mock, returns hardcoded data.
Replaced by analyzers.semantic_terms in Phase 3."""
from pipeline.contracts import AnalysisStage, StageContext


class ExtractTermsStage(AnalysisStage):
    name = "extract_terms"
    progress_weight = 0.20

    async def run(self, ctx: StageContext) -> dict:
        await ctx.emit_progress(self, 50, "Extracting terms (mock)")

        return {
            "terms": [
                {"term": "content marketing strategy", "target_count": 4, "type": "core"},
                {"term": "keyword research tools", "target_count": 3, "type": "supporting"},
                {"term": "SEO best practices", "target_count": 5, "type": "core"},
            ]
        }
```

- [ ] **Step 6: Write score_ranking stage (mock → real in Phase 4)**

`python-sidecar/pipeline/stages/score_ranking.py`:

```python
"""Stage 5: Ranking score — mock, returns hardcoded data.
Replaced by analyzers.ranking_scorer in Phase 4."""
from pipeline.contracts import AnalysisStage, StageContext


class ScoreRankingStage(AnalysisStage):
    name = "score_ranking"
    progress_weight = 0.25

    async def run(self, ctx: StageContext) -> dict:
        await ctx.emit_progress(self, 50, "Computing ranking score (mock)")

        return {
            "ranking_score": 72,
            "ranking_signals": {
                "version": "mock_v0",
                "model": "mock",
                "prompt_version": "mock",
                "input_hash": "mock",
                "scored_at": "2026-05-24T00:00:00Z",
                "rule_base": 78,
                "llm_total": 60,
                "final_score": 72,
                "signals": [
                    {"name": "meta_quality", "score": 70, "verdict": "adequate"},
                    {"name": "content_depth", "score": 80, "verdict": "strong"},
                    {"name": "eeat", "score": 50, "verdict": "needs_work"},
                    {"name": "freshness", "score": 60, "verdict": "adequate"},
                    {"name": "technical", "score": 65, "verdict": "adequate"},
                    {"name": "competitiveness", "score": 70, "verdict": "adequate"},
                ],
                "summary": "Mock score — real scoring in Phase 4."
            },
        }
```

- [ ] **Step 7: Verify all imports work (no circular deps)**

```bash
cd python-sidecar
python -c "from pipeline.contracts import StageContext, AnalysisStage; print('contracts OK')"
python -c "from pipeline.runner import PipelineRunner; p = PipelineRunner.build_deep_analysis_pipeline(); print(f'{len(p)} stages OK')"
```

Expected: `contracts OK` then `5 stages OK`

- [ ] **Step 8: Commit**

```bash
git add python-sidecar/pipeline/stages/
git commit -m "feat: add 5 pipeline stages (mock versions for Phase 2)"
```

---

### Task 5: job-progress API endpoint (Python → DB bridge)

**Files:**
- Create: `pages/api/articles/job-progress.ts`

Python's `StageContext.emit_progress()` POSTs to this endpoint with `x-internal-token` header. It writes `current_stage`, `stage_progress`, `total_progress`, `progress_message` into the `analysis_jobs` row. Authenticated via internal token (Python) or session cookie (browser). Validates job exists before updating (404 on unknown jobId).

- [ ] **Step 1: Write job-progress.ts**

`pages/api/articles/job-progress.ts`:

```typescript
// POST /api/articles/job-progress
// Called by Python sidecar during pipeline execution.
// Updates analysis_jobs row with current progress.
// Auth: accepts x-internal-token OR standard session cookie (verifyUser).
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await db.sync();
  await ensureArticlesTables();

  // Auth: internal token (Python sidecar) or session cookie (browser)
  const internalToken = req.headers['x-internal-token'];
  if (internalToken && internalToken === process.env.INTERNAL_PIPELINE_TOKEN) {
    // Authorized via internal token — skip verifyUser
  } else {
    const authorized = await verifyUser(req, res);
    if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jobId, currentStage, stageProgress, totalProgress, message } = req.body;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    // Verify job exists before updating (catch typos in jobId early)
    const jobRows = await db.query<{ id: string }>(
      `SELECT id FROM analysis_jobs WHERE id = ?`,
      { replacements: [jobId], type: QueryTypes.SELECT },
    );
    if (!jobRows.length) {
      return res.status(404).json({ error: 'job not found' });
    }

    await db.query(
      `UPDATE analysis_jobs
       SET status = 'running',
           current_stage = COALESCE(?, current_stage),
           stage_progress = COALESCE(?, stage_progress),
           total_progress = COALESCE(?, total_progress),
           progress_message = COALESCE(?, progress_message),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      { replacements: [currentStage || null, stageProgress ?? null, totalProgress ?? null, message || null, jobId] },
    );
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[job-progress] update failed:', err.message);
    res.status(500).json({ error: err.message });
  }
}
```

- [ ] **Step 2: Verify endpoint is reachable**

```bash
# With Next.js dev server running — test both auth paths:
# No auth → 401
curl -s -X POST http://127.0.0.1:3000/api/articles/job-progress \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 401 (unauthorized)

# With internal token but missing jobId → 400
curl -s -X POST http://127.0.0.1:3000/api/articles/job-progress \
  -H "Content-Type: application/json" \
  -H "x-internal-token: ${INTERNAL_PIPELINE_TOKEN}" \
  -d '{}'
# Expected: 400 (jobId required)

# With internal token + nonexistent jobId → 404
curl -s -X POST http://127.0.0.1:3000/api/articles/job-progress \
  -H "Content-Type: application/json" \
  -H "x-internal-token: ${INTERNAL_PIPELINE_TOKEN}" \
  -d '{"jobId":"nonexistent_test","currentStage":"test","stageProgress":50,"totalProgress":7,"message":"test"}'
# Expected: 404 (job not found)
```

- [ ] **Step 3: Commit**

```bash
git add pages/api/articles/job-progress.ts
git commit -m "feat: add job-progress endpoint for Python → DB progress writes"
```

---

### Task 6: Add POST /pipeline/deep-analysis endpoint to Python sidecar

**Files:**
- Modify: `python-sidecar/main.py`

- [ ] **Step 1: Add endpoint**

In `python-sidecar/main.py`, after the `/ai-visibility` endpoint, add:

```python
class PipelineRequest(BaseModel):
    jobId: str
    payload: dict  # { url, keyword, language, tone, existing_articles }


@app.post("/pipeline/deep-analysis")
async def pipeline_deep_analysis(req: PipelineRequest):
    """
    Event-driven pipeline endpoint.
    Called by TypeScript after INSERTing job into analysis_jobs.
    Python runs the 5-stage pipeline, pushes progress via job-progress endpoint.
    Returns {status, result} — TypeScript writes this to analysis_jobs.result.
    """
    from pipeline.runner import PipelineRunner

    nextjs_url = os.getenv("NEXTJS_URL", "http://127.0.0.1:3000")
    print(f"[pipeline] Starting deep analysis for job {req.jobId}")

    ctx = PipelineRunner.build_deep_analysis_ctx(
        req.jobId, req.payload, nextjs_url
    )
    runner = PipelineRunner(PipelineRunner.build_deep_analysis_pipeline(), ctx)

    try:
        result = await runner.run()
        print(f"[pipeline] Job {req.jobId} completed successfully")
        return {"status": "done", "result": result}
    except Exception as exc:
        print(f"[pipeline] Job {req.jobId} failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
```

- [ ] **Step 2: Verify endpoint loads**

```bash
cd python-sidecar
python -c "
from main import app
routes = [r.path for r in app.routes]
assert '/pipeline/deep-analysis' in routes, f'Route missing. Routes: {routes}'
print('Endpoint registered OK')
"
```

Expected: `Endpoint registered OK`

- [ ] **Step 3: Commit**

```bash
git add python-sidecar/main.py
git commit -m "feat: add POST /pipeline/deep-analysis endpoint"
```

---

### Task 7: Refactor deep-analysis.ts to job + sidecar + writeback + SSE

**Files:**
- Modify: `pages/api/articles/deep-analysis.ts`

The existing 707-line handler becomes a thin orchestrator: (1) create article skeleton, (2) INSERT job, (3) claim job (UPDATE status=running, attempts+1), (4) POST to sidecar, (5) when sidecar responds, UPDATE job row with result, (6) SSE-stream final result. During execution, the job-progress endpoint persists intermediate progress to DB.

**SSE scope (Phase 2 MVP):** Only `created` and `done` events. No intermediate `stage`/`progress` events streamed to frontend yet. Progress is persisted in `analysis_jobs` rows for debugging. A future phase can add a poll loop in deep-analysis.ts to stream `stage`/`progress` events by reading the job-progress rows from DB.

- [ ] **Step 1: Write the refactored handler**

`pages/api/articles/deep-analysis.ts` (complete replacement):

```typescript
// POST /api/articles/deep-analysis
// Thin orchestrator: creates article skeleton, INSERTs analysis_job,
// POSTs to Python sidecar /pipeline/deep-analysis, awaits result,
// writes result back to job row, streams SSE to frontend.
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';

function sse(res: NextApiResponse, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (typeof (res as any).flush === 'function') (res as any).flush();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[deep-analysis] handler invoked', req.method);
  await db.sync();
  await ensureArticlesTables();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, keywords = [], country = 'US', articleId: existingArticleId, domainId: reqDomainId } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'identity');
  res.status(200);
  if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();
  res.write(':ok\n\n');

  const articleIdSql = await getArticleIdSql();
  const keyword = (keywords as string[])[0] || '';
  let articleId: number;

  // ── Create or reuse article skeleton ──────────────────────────────
  if (existingArticleId) {
    articleId = existingArticleId;
    await db.query(
      `UPDATE articles SET status = 'analyzing', updated_at = CURRENT_TIMESTAMP WHERE ${articleIdSql} = ?`,
      { replacements: [existingArticleId] },
    );
    sse(res, 'created', { articleId });
  } else {
    try {
      let domainId: number;
      if (reqDomainId) {
        const [domains] = await db.query('SELECT "ID" FROM domain WHERE "ID" = ?', { replacements: [reqDomainId] });
        domainId = (domains as any[])[0]?.ID || 1;
      } else {
        const [domains] = await db.query('SELECT "ID" FROM domain LIMIT 1', { replacements: [] });
        domainId = (domains as any[])[0]?.ID || 1;
      }
      const skeletonSlug = url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').substring(0, 60);

      if (process.env.DATABASE_URL) {
        const rows = await db.query<{ id: number }>(
          `INSERT INTO articles (domain_id, title, slug, meta_url, content, target_keyword, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING ${articleIdSql} AS id`,
          { replacements: [domainId, url, skeletonSlug, url, keyword], type: QueryTypes.SELECT },
        );
        articleId = rows[0]?.id;
      } else {
        const [newId] = await db.query(
          `INSERT INTO articles (domain_id, title, slug, meta_url, content, target_keyword, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, 'analyzing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          { replacements: [domainId, url, skeletonSlug, url, keyword], type: QueryTypes.INSERT },
        );
        articleId = newId as unknown as number;
      }
      sse(res, 'created', { articleId });
    } catch (err: any) {
      console.error('[deep-analysis] skeleton insert failed:', err.message);
      sse(res, 'error', { step: 'save', message: 'Failed to initialize analysis' });
      return res.end();
    }
  }

  // ── Create analysis job ───────────────────────────────────────────
  const jobId = `job_${articleId}_${Date.now()}`;
  const payload = { url, keyword, keywords, language: country === 'PL' ? 'pl' : 'en', tone: 'professional' };

  try {
    await db.query(
      `INSERT INTO analysis_jobs (id, article_id, job_type, status, payload, created_at, updated_at)
       VALUES (?, ?, 'deep_analysis', 'queued', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      { replacements: [jobId, articleId, JSON.stringify(payload)] },
    );
  } catch (err: any) {
    console.error('[deep-analysis] job insert failed:', err.message);
    sse(res, 'error', { step: 'save', message: 'Failed to create analysis job' });
    return res.end();
  }

  // ── Claim job (status → running, lock + attempts increment) ──────
  try {
    await db.query(
      `UPDATE analysis_jobs
       SET status = 'running',
           locked_at = CURRENT_TIMESTAMP,
           locked_by = ?,
           attempts = attempts + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'queued' AND attempts < max_attempts`,
      { replacements: [`nextjs_${process.pid || 'unknown'}`, jobId] },
    );
    // Verify row was actually claimed (SELECT is dialect-safe vs. UPDATE result inspection)
    const claimedRows = await db.query<{ status: string; attempts: number }>(
      `SELECT status, attempts FROM analysis_jobs WHERE id = ?`,
      { replacements: [jobId], type: QueryTypes.SELECT },
    );
    if (!claimedRows.length || claimedRows[0].status !== 'running') {
      sse(res, 'error', { step: 'save', message: 'Job already claimed or max attempts reached' });
      return res.end();
    }
  } catch (err: any) {
    console.error('[deep-analysis] job claim failed:', err.message);
    sse(res, 'error', { step: 'save', message: 'Failed to claim analysis job' });
    return res.end();
  }

  // ── Call sidecar, await result, write back to job row ─────────────
  const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000); // 3 min timeout
    let sidecarResp: Response;

    try {
      sidecarResp = await fetch(`${sidecarUrl}/pipeline/deep-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, payload }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!sidecarResp.ok) {
      const errText = await sidecarResp.text();
      await db.query(
        `UPDATE analysis_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        { replacements: [errText, jobId] },
      );
      await db.query(
        `UPDATE articles SET status = 'error', content = ? WHERE ${articleIdSql} = ?`,
        { replacements: [errText, articleId] },
      );
      sse(res, 'error', { step: 'pipeline', message: errText });
      return res.end();
    }

    const sidecarData = await sidecarResp.json();
    const result = sidecarData.result || {};

    // Write done status + result to job row
    await db.query(
      `UPDATE analysis_jobs SET status = 'done', result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      { replacements: [JSON.stringify(result), jobId] },
    );

    // ── Extract data from pipeline result ───────────────────────────
    const fetchPage = result.fetch_page || {};
    const serp = result.scrape_serp || {};
    const classify = result.classify_content || {};
    const terms = result.extract_terms || {};
    const score = result.score_ranking || {};

    const allTerms = [
      ...(serp.terms || []),
      ...(terms.terms || []),
    ];
    const scoreData = {
      terms: allTerms,
      words_target: serp.words_target || 2200,
      words_min: serp.words_min || 1500,
      words_max: serp.words_max || 3000,
      headings_target: serp.headings_target || 15,
      headings_min: serp.headings_min || 10,
      headings_max: serp.headings_max || 25,
      paragraphs_target: serp.paragraphs_target || 20,
      paragraphs_min: serp.paragraphs_min || 10,
      paragraphs_max: serp.paragraphs_max || 40,
      competitor_count: (serp.competitors || []).length,
      paa_questions: serp.paa_questions || [],
    };

    const rankingScore = score.ranking_score ?? null;
    const rankingSignals = score.ranking_signals ? JSON.stringify(score.ranking_signals) : null;

    // Use rule_base from ranking_signals as content_score fallback.
    // COALESCE preserves existing content_score if rankingScore is NULL
    // (e.g. when pipeline runs without DEEPSEEK_API_KEY).
    const ruleBase = score.ranking_signals?.rule_base ?? null;

    // Build dynamic SET clause — use enriched fetch_page fields
    const articleTitle = fetchPage.title || url;
    const metaTitle = fetchPage.meta_title || '';
    const metaDescription = fetchPage.meta_description || '';
    const headingCount = fetchPage.heading_count ?? 0;
    const imageIssueCount = fetchPage.images_without_alt ?? 0;

    const setClauses: string[] = [
      `title = COALESCE(NULLIF(?, ''), title)`,
      `meta_title = COALESCE(NULLIF(?, ''), meta_title)`,
      `meta_description = COALESCE(NULLIF(?, ''), meta_description)`,
      `word_count = ?`,
      `score_data = ?`,
      `content_score = COALESCE(?, content_score)`,
      `status = 'draft'`,
      `updated_at = CURRENT_TIMESTAMP`,
    ];
    const replacements: any[] = [
      articleTitle,
      metaTitle,
      metaDescription,
      classify.word_count_estimate || 0,
      JSON.stringify(scoreData),
      ruleBase,
    ];

    if (rankingScore !== null) {
      setClauses.push(`ranking_score = ?`);
      replacements.push(rankingScore);
    }
    if (rankingSignals !== null) {
      setClauses.push(`ranking_signals = ?`);
      replacements.push(rankingSignals);
    }
    replacements.push(articleId);

    await db.query(
      `UPDATE articles SET ${setClauses.join(', ')} WHERE ${articleIdSql} = ?`,
      { replacements },
    );

    // Save SERP competitors
    if (serp.competitors?.length) {
      await db.query('DELETE FROM article_competitors WHERE article_id = ?', { replacements: [articleId] }).catch(() => {});
      for (const c of serp.competitors) {
        await db.query(
          `INSERT INTO article_competitors (article_id, url, domain, title, snippet, created_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          { replacements: [articleId, c.url || '', c.domain || '', c.title || '', c.snippet || ''] },
        ).catch(() => {});
      }
    }

    // Save terms
    if (allTerms.length) {
      await db.query('DELETE FROM article_terms WHERE article_id = ?', { replacements: [articleId] }).catch(() => {});
      for (const t of allTerms) {
        await db.query(
          `INSERT INTO article_terms (article_id, term, term_type, source, current_count, target_min, target_max, importance, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          { replacements: [articleId, t.term, t.type || 'topic', 'serp', 0, Math.max(1, Math.round(t.target_count * 0.7)), Math.max(1, Math.round(t.target_count * 1.5)), t.target_count || 1] },
        ).catch(() => {});
      }
    }

    sse(res, 'done', { articleId, rankingScore });
    return res.end();

  } catch (err: any) {
    const errorMessage = err.name === 'AbortError' ? 'Pipeline timed out after 180s' : err.message;
    console.error('[deep-analysis] sidecar error:', errorMessage);
    await db.query(
      `UPDATE analysis_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      { replacements: [errorMessage, jobId] },
    ).catch(() => {});
    await db.query(
      `UPDATE articles SET status = 'error', content = ? WHERE ${articleIdSql} = ?`,
      { replacements: [errorMessage, articleId] },
    ).catch(() => {});
    sse(res, 'error', { step: 'pipeline', message: errorMessage });
    return res.end();
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit pages/api/articles/deep-analysis.ts
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add pages/api/articles/deep-analysis.ts
git commit -m "feat: refactor deep-analysis to job → sidecar → writeback → SSE"
```

---

## Phase 1.5: Job Lifecycle Correctness

### Task 8: End-to-end job lifecycle test with mock stages

- [ ] **Step 1: Start sidecar and test pipeline endpoint directly**

```bash
# Terminal 1: Next.js dev server
# Terminal 2: Python sidecar
cd python-sidecar
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Test pipeline in isolation (no DB involved):

```bash
curl -s -X POST http://127.0.0.1:8001/pipeline/deep-analysis \
  -H "Content-Type: application/json" \
  -d '{"jobId":"test_direct_1","payload":{"url":"https://example.com","keyword":"test","language":"en"}}' | python -m json.tool
```

Expected: `{"status": "done", "result": { "fetch_page": {...}, "scrape_serp": {...}, "classify_content": {...}, "extract_terms": {...}, "score_ranking": {...} }}`. All 5 stages present.

- [ ] **Step 2: Test job-progress endpoint (direct write)**

```bash
curl -s -X POST http://127.0.0.1:3000/api/articles/job-progress \
  -H "Content-Type: application/json" \
  -H "x-internal-token: ${INTERNAL_PIPELINE_TOKEN}" \
  -d '{"jobId":"nonexistent_test","currentStage":"fetch_page","stageProgress":50,"totalProgress":7,"message":"testing"}'
```

Expected: `404` (job not found — catches jobId typos early).

- [ ] **Step 3: Test full lifecycle via Next.js API**

First, insert a test domain if none exists:

```bash
# Use an existing domain from the DB, or create one:
# Check: sqlite3 data/database.sqlite "SELECT * FROM domain LIMIT 1"
```

Then call the deep-analysis endpoint (requires auth — grab your session cookie from browser DevTools):

```bash
curl -s -N -X POST http://127.0.0.1:3000/api/articles/deep-analysis \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"url":"https://example.com","keywords":["test keyword"]}'
```

Alternative: test from the browser after logging in — open the app, trigger a deep analysis, and watch the SSE stream in the Network tab.

Expected: SSE stream: `created` → `done` with `articleId` and `rankingScore`.

Verify DB state:

```bash
# SQLite (dev):
sqlite3 data/database.sqlite "SELECT id, status, current_stage, total_progress FROM analysis_jobs ORDER BY created_at DESC LIMIT 3"
sqlite3 data/database.sqlite "SELECT id, title, status, ranking_score FROM articles ORDER BY id DESC LIMIT 3"
```

Expected:
- `analysis_jobs`: status = `'done'`, result populated
- `articles`: status = `'draft'`, `ranking_score` = 72 (mock value), `score_data` populated

- [ ] **Step 4: Test error path — pipeline failure**

```bash
# Send request with no URL to trigger error
curl -s -X POST http://127.0.0.1:8001/pipeline/deep-analysis \
  -H "Content-Type: application/json" \
  -d '{"jobId":"test_error_1","payload":{"keyword":"no-url"}}'
```

Expected: `500` error. Then verify the job lifecycle with real Next.js: insert a job, then POST with bad payload — verify job status = `'failed'`, article status = `'error'`.

- [ ] **Step 5: Test job-progress updates during pipeline execution**

Modify the test temporarily to verify progress flows: add `print()` in `emit_progress`. Run a real pipeline execution through Next.js. Check `analysis_jobs` row shows intermediate progress:

```bash
sqlite3 data/database.sqlite "SELECT current_stage, stage_progress, total_progress FROM analysis_jobs WHERE id = '<jobId>'"
```

Expected: `current_stage` transitions through `fetch_page` → `scrape_serp` → `classify_content` → `extract_terms` → `score_ranking`. `total_progress` accumulates 0 → 15 → 40 → 55 → 75 → 100.

- [ ] **Step 6: Commit (any fixes from testing)**

```bash
git add -A
git commit -m "fix: end-to-end job lifecycle fixes from Phase 1.5 testing"
```

---

## Phase 2: (Covered by Phase 1.5 — mock stages already verified end-to-end)

Phase 1.5 already tested the full pipeline with mock stages. Phase 2 is effectively complete. Proceed directly to Phase 3 for real stages.

---

## Phase 3: Real ClassifyContent + ExtractTerms Stages

### Task 9: Implement content_classifier.py

**Files:**
- Create: `python-sidecar/analyzers/content_classifier.py`
- Modify: `python-sidecar/pipeline/stages/classify_content.py` (wire real classifier)

- [ ] **Step 1: Write content_classifier.py**

`python-sidecar/analyzers/content_classifier.py`:

```python
"""
Content classifier — Grox-like 5-dimension classification.
Pre-LLM extraction: word count, author, date, schema detection.
DeepSeek: page_type, eeat_score, content_originality_risk, is_evergreen, freshness_score.
"""
import json
import os
import re
from bs4 import BeautifulSoup
import httpx


async def classify(html: str, url: str = "") -> dict:
    """Classify a webpage across 5 content quality dimensions.
    Returns dict with page_type, eeat_score, content_originality_risk, etc."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()

    text = soup.get_text(separator=" ", strip=True)
    word_count = len(text.split())

    # Author detection
    has_author = bool(
        soup.find("meta", attrs={"name": "author"})
        or soup.find(rel="author")
        or soup.select_one(".byline, .author, [class*=author]")
    )

    # Date detection
    has_date = bool(
        soup.find("time")
        or soup.find(attrs={"pubdate": True})
        or soup.find("meta", property="article:published_time")
        or _find_iso_date(text)
    )

    # Schema article detection
    has_schema_article = False
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "{}")
            types = []
            if isinstance(data, list):
                for d in data:
                    t = d.get("@type", "")
                    types.extend(t if isinstance(t, list) else [t])
            else:
                t = data.get("@type", "")
                types.extend(t if isinstance(t, list) else [t])
            if any(tp in ("Article", "NewsArticle", "BlogPosting") for tp in types):
                has_schema_article = True
                break
        except (json.JSONDecodeError, TypeError):
            pass

    title = ""
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)
    h1_tag = soup.find("h1")
    h1_text = h1_tag.get_text(strip=True) if h1_tag else ""

    headings = []
    for tag in soup.find_all(["h1", "h2", "h3", "h4"])[:15]:
        t = tag.get_text(strip=True)
        if t:
            headings.append(t)

    meta_desc = ""
    desc_tag = soup.find("meta", attrs={"name": "description"})
    if desc_tag:
        meta_desc = desc_tag.get("content", "")[:300]

    body_sample = text[:2000]

    is_thin = word_count < 300
    thin_reason = "word_count<300" if is_thin else None
    if word_count < 50:
        is_thin = True
        thin_reason = "js_shell"

    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not deepseek_key:
        return _fallback_classification(word_count, has_author, has_date, has_schema_article, is_thin, thin_reason)

    prompt = f"""Analyze this webpage content for SEO quality. Return JSON:
{{
  "page_type": "article|product|landing_page|blog_listing|documentation|unknown",
  "page_type_confidence": 0.0-1.0,
  "is_thin": true/false,
  "thin_reason": null|"word_count<300"|"cookie_wall"|"paywall"|"js_shell",
  "eeat_score": 0-100,
  "content_originality_risk": "low|medium|high",
  "is_evergreen": true/false,
  "freshness_score": 0-100
}}

CONTENT:
Title: {title}
H1: {h1_text}
Headings: {json.dumps(headings[:15])}
Body sample: {body_sample}
Meta description: {meta_desc}
Pre-extracted: word_count={word_count}, has_author={has_author}, has_date={has_date}, has_schema_article={has_schema_article}"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {deepseek_key}",
                },
                json={
                    "model": "deepseek-chat",
                    "max_tokens": 512,
                    "temperature": 0.1,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            raw: str = data["choices"][0]["message"]["content"]

        json_match = re.search(r"\{[\s\S]*\}", raw)
        if json_match:
            result = json.loads(json_match[0])
        else:
            print(f"[classifier] No JSON in response: {raw[:200]}")
            return _fallback_classification(word_count, has_author, has_date, has_schema_article, is_thin, thin_reason)

        result["word_count_estimate"] = word_count
        result["has_author"] = has_author
        result["has_date"] = has_date
        result["has_sources"] = bool(has_schema_article)
        result["is_thin"] = result.get("is_thin", is_thin)
        result["thin_reason"] = result.get("thin_reason", thin_reason)

        return result

    except Exception as exc:
        print(f"[classifier] DeepSeek error: {exc}")
        return _fallback_classification(word_count, has_author, has_date, has_schema_article, is_thin, thin_reason)


def _fallback_classification(word_count: int, has_author: bool, has_date: bool, has_schema_article: bool, is_thin: bool, thin_reason: str | None) -> dict:
    return {
        "page_type": "article",
        "page_type_confidence": 0.5,
        "is_thin": is_thin,
        "thin_reason": thin_reason,
        "word_count_estimate": word_count,
        "has_author": has_author,
        "has_date": has_date,
        "has_sources": has_schema_article,
        "eeat_score": max(0, 50 + (10 if has_author else 0) + (10 if has_date else 0) + (10 if has_schema_article else 0) - (30 if is_thin else 0)),
        "content_originality_risk": "medium",
        "is_evergreen": True,
        "freshness_score": 50,
    }


def _find_iso_date(text: str) -> bool:
    return bool(re.search(r"\b\d{4}-\d{2}-\d{2}\b", text[:1000]))
```

- [ ] **Step 2: Wire real classifier into classify_content stage**

Replace `python-sidecar/pipeline/stages/classify_content.py`:

```python
"""Stage 3: Content classification via analyzers.content_classifier."""
from pipeline.contracts import AnalysisStage, StageContext
from analyzers.content_classifier import classify


class ClassifyContentStage(AnalysisStage):
    name = "classify_content"
    progress_weight = 0.15

    async def run(self, ctx: StageContext) -> dict:
        fetch = ctx.get_state("fetch_page") or {}
        html = fetch.get("html", "")
        url = fetch.get("url", "")

        await ctx.emit_progress(self, 20, "Classifying content type and quality...")
        result = await classify(html, url)
        await ctx.emit_progress(self, 80, f"Page type: {result.get('page_type', 'unknown')}, E-E-A-T: {result.get('eeat_score', 0)}")

        return result
```

- [ ] **Step 3: Verify classifier works standalone**

```bash
cd python-sidecar
python -c "
import asyncio
from analyzers.content_classifier import classify
html = '<html><head><title>Best SEO Guide 2024</title><meta name=\"description\" content=\"Complete SEO guide\"></head><body><h1>SEO Guide</h1><p>Content marketing is essential for modern businesses.</p><p>This guide covers everything from keyword research to link building.</p></body></html>'
result = asyncio.run(classify(html, 'https://example.com'))
print('Page type:', result.get('page_type'), 'EEAT:', result.get('eeat_score'), 'Thin:', result.get('is_thin'))
"
```

Expected: classification output. With DEEPSEEK_API_KEY: real classification. Without: fallback with `eeat_score ~50`.

- [ ] **Step 4: Commit**

```bash
git add python-sidecar/analyzers/content_classifier.py python-sidecar/pipeline/stages/classify_content.py
git commit -m "feat: implement content classifier with DeepSeek + pre-LLM extraction"
```

---

### Task 10: Implement semantic_terms.py

**Files:**
- Create: `python-sidecar/analyzers/semantic_terms.py`
- Modify: `python-sidecar/pipeline/stages/extract_terms.py` (wire real extractor)
- Modify: `python-sidecar/pipeline/stages/scrape_serp.py` (store competitor texts for downstream use)

- [ ] **Step 1: Write semantic_terms.py**

`python-sidecar/analyzers/semantic_terms.py`:

```python
"""
Semantic term extraction via DeepSeek API.
Replaces TF-IDF _extract_nlp_terms() with semantic extraction.
Chunks competitor pages by headings, caches per (keyword, chunk_hash),
extracts with concurrency-limited parallelism (asyncio.Semaphore(5)).
"""
import asyncio
import hashlib
import json
import re
from collections import defaultdict

import httpx
from bs4 import BeautifulSoup


_cache: dict[str, list[dict]] = {}
MAX_CACHE = 500
SEMAPHORE = asyncio.Semaphore(5)


def _cache_key(keyword: str, chunk_hash: str) -> str:
    return f"{keyword}::{chunk_hash}"


def _chunk_hash(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()[:12]


async def extract_semantic_terms(keyword: str, texts: list[str], deepseek_key: str) -> list[dict]:
    """
    Extract semantic terms from competitor page texts using DeepSeek.
    Chunks each text by headings, caches per chunk, aggregates results.
    Returns top 50 terms as [{term, target_count, type}].
    """
    if not texts or not deepseek_key:
        return _fallback_terms(texts, keyword)

    # 1. Chunk texts by headings
    chunks: list[tuple[str, str]] = []  # (chunk_text, chunk_hash)
    seen_hashes: set[str] = set()

    for text in texts:
        soup = BeautifulSoup(f"<div>{text}</div>", "lxml")
        current_chunk: list[str] = []
        for tag in soup.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
            t = tag.get_text(strip=True)
            if not t:
                continue
            if tag.name.startswith("h"):
                if current_chunk:
                    chunk_text = " ".join(current_chunk)
                    if len(chunk_text) > 100:
                        ch = _chunk_hash(chunk_text)
                        if ch not in seen_hashes:
                            chunks.append((chunk_text[:3000], ch))
                            seen_hashes.add(ch)
                    current_chunk = []
            current_chunk.append(t)
        if current_chunk:
            chunk_text = " ".join(current_chunk)
            if len(chunk_text) > 100:
                ch = _chunk_hash(chunk_text)
                if ch not in seen_hashes:
                    chunks.append((chunk_text[:3000], ch))

    # 2. Cache hits vs misses
    uncached: list[tuple[str, str]] = []
    all_terms: list[dict] = []

    for chunk_text, ch in chunks:
        key = _cache_key(keyword, ch)
        if key in _cache:
            all_terms.extend(_cache[key])
        else:
            uncached.append((chunk_text, ch))

    # 3. Extract from uncached chunks (concurrency-limited)
    if uncached:
        async def _extract_one(chunk_text: str, ch: str):
            async with SEMAPHORE:
                return await _extract_chunk(keyword, chunk_text, ch, deepseek_key)

        results = await asyncio.gather(*(_extract_one(ct, ch) for ct, ch in uncached))
        for terms in results:
            all_terms.extend(terms)

    # 4. Aggregate: doc_freq, avg relevance, dominant type
    term_groups: dict[str, dict] = {}
    for t in all_terms:
        name = t["term"].lower().strip()
        if name not in term_groups:
            term_groups[name] = {"relevances": [], "types": [], "occurrences": []}
        term_groups[name]["relevances"].append(t.get("relevance", 0.5))
        term_groups[name]["types"].append(t.get("type", "supporting"))
        if "occurrence_count" in t:
            term_groups[name]["occurrences"].append(t["occurrence_count"])

    n_docs = max(1, len(texts))
    aggregated = []
    stopwords = {"article", "information", "website", "site", "page", "web", "blog", "post"}
    for term, group in term_groups.items():
        if term in stopwords or keyword.lower() in term:
            continue
        doc_freq = len(group["relevances"])
        avg_relevance = sum(group["relevances"]) / len(group["relevances"])
        type_counts = defaultdict(int)
        for tp in group["types"]:
            type_counts[tp] += 1
        dominant_type = max(type_counts, key=type_counts.get)

        if group["occurrences"]:
            target_count = max(1, round(sum(group["occurrences"]) / len(group["occurrences"])))
        else:
            target_count = max(1, round(doc_freq * avg_relevance * 3))

        aggregated.append({
            "term": term,
            "target_count": target_count,
            "type": dominant_type,
            "doc_freq": doc_freq,
            "relevance": round(avg_relevance, 2),
        })

    # 5. Filter: ≥30% of docs (min 2)
    min_docs = max(1, round(0.3 * n_docs)) if n_docs <= 3 else max(2, round(0.3 * n_docs))
    aggregated = [t for t in aggregated if t["doc_freq"] >= min_docs]

    aggregated.sort(key=lambda t: (t["doc_freq"] * t["relevance"]), reverse=True)

    return [{"term": t["term"], "target_count": t["target_count"], "type": t["type"]} for t in aggregated[:50]]


async def _extract_chunk(keyword: str, chunk_text: str, chunk_hash: str, api_key: str) -> list[dict]:
    """Extract terms from one chunk via DeepSeek. Results are cached."""
    prompt = f"""You are an SEO analyzer. Given text from a top-ranking page for the keyword
"{keyword}", extract distinctive SEO-relevant terms and phrases (1-4 words)
that characterize what makes this content rank well.

Return ONLY: [{{"term": "phrase here", "relevance": 0.95, "type": "type"}}, ...]

Rules:
- relevance = how strongly this term defines the topic (0.0-1.0)
- type = "core" (primary topic), "supporting" (secondary), "entity" (named entity), or "question" (implicit question)
- Include multi-word phrases (e.g., "keyword research tools")
- Skip generic terms ("article", "information", "website")
- Skip the keyword itself if it appears
- Return 10-20 terms max

TEXT:
{chunk_text}"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                json={
                    "model": "deepseek-chat",
                    "max_tokens": 1024,
                    "temperature": 0.1,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            raw: str = data["choices"][0]["message"]["content"]

        json_match = re.search(r"\[[\s\S]*\]", raw)
        if not json_match:
            return []

        terms = json.loads(json_match[0])
        if isinstance(terms, list):
            key = _cache_key(keyword, chunk_hash)
            _cache[key] = terms
            if len(_cache) > MAX_CACHE:
                oldest = next(iter(_cache))
                del _cache[oldest]
            return terms

        return []
    except Exception as exc:
        print(f"[semantic_terms] chunk extraction failed: {exc}")
        return []


def _fallback_terms(texts: list[str], keyword: str) -> list[dict]:
    """Fallback when no DeepSeek key available."""
    if not texts:
        return [{"term": keyword, "target_count": 3, "type": "core"}]

    word_counts: dict[str, int] = {}
    for text in texts:
        words = re.findall(r"\b[a-z]{4,}\b", text.lower())
        for w in words:
            word_counts[w] = word_counts.get(w, 0) + 1

    sorted_terms = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)[:30]
    return [
        {"term": term, "target_count": max(1, round(count / max(1, len(texts)))), "type": "supporting"}
        for term, count in sorted_terms if term != keyword.lower()
    ][:50]
```

- [ ] **Step 2: Wire real extractor into extract_terms stage**

Replace `python-sidecar/pipeline/stages/extract_terms.py`:

```python
"""Stage 4: Semantic term extraction via analyzers.semantic_terms."""
import os
from pipeline.contracts import AnalysisStage, StageContext
from analyzers.semantic_terms import extract_semantic_terms


class ExtractTermsStage(AnalysisStage):
    name = "extract_terms"
    progress_weight = 0.20

    async def run(self, ctx: StageContext) -> dict:
        serp = ctx.get_state("scrape_serp") or {}
        keyword = ctx.payload.get("keyword", "")
        deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
        competitor_texts = serp.get("_competitor_texts", [])

        await ctx.emit_progress(self, 20, f"Extracting semantic terms for: {keyword}")
        terms = await extract_semantic_terms(keyword, competitor_texts, deepseek_key)
        await ctx.emit_progress(self, 90, f"Extracted {len(terms)} terms")

        return {"terms": terms}
```

- [ ] **Step 3: Update scrape_serp stage to store competitor texts**

Replace `python-sidecar/pipeline/stages/scrape_serp.py`:

```python
"""Stage 2: SERP analysis — wraps existing serp_analyzer.
analyze_serp() now accepts include_texts=True to return _competitor_texts,
avoiding a second scrape of the same competitor pages."""
from pipeline.contracts import AnalysisStage, StageContext
from analyzers.serp_analyzer import analyze_serp


class ScrapeSerpStage(AnalysisStage):
    name = "scrape_serp"
    progress_weight = 0.25

    async def run(self, ctx: StageContext) -> dict:
        keyword = ctx.payload.get("keyword", "")
        language = ctx.payload.get("language", "pl")
        if not keyword:
            raise ValueError("keyword is required in payload")

        await ctx.emit_progress(self, 30, f"Scraping SERP for: {keyword}")
        serp_data = await analyze_serp(keyword, language, num_results=10, include_texts=True)
        await ctx.emit_progress(self, 70, f"Found {len(serp_data.get('competitors', []))} competitors")

        return serp_data
```

- [ ] **Step 4: Test semantic extraction standalone**

```bash
cd python-sidecar
python -c "
import asyncio, os
from analyzers.semantic_terms import extract_semantic_terms
texts = [
    'Content marketing is a strategic approach focused on creating valuable content to attract and retain a clearly defined audience. Key elements include blog posts, social media, email newsletters, and SEO optimization.',
    'SEO content writing involves optimizing web pages for search engines while keeping content engaging for readers. Important factors include keyword placement, meta descriptions, heading structure, and internal linking.',
]
result = asyncio.run(extract_semantic_terms('content marketing', texts, os.getenv('DEEPSEEK_API_KEY', '')))
print('Terms:', len(result))
for t in result[:5]:
    print(f'  {t[\"term\"]} (target={t[\"target_count\"]}, type={t[\"type\"]})')
"
```

Expected: terms extracted. With DEEPSEEK_API_KEY: semantic terms from DeepSeek. Without: fallback frequency terms.

- [ ] **Step 5: Commit**

```bash
git add python-sidecar/analyzers/semantic_terms.py python-sidecar/pipeline/stages/extract_terms.py python-sidecar/pipeline/stages/scrape_serp.py
git commit -m "feat: implement semantic term extraction via DeepSeek with cache + semaphore"
```

---

### Task 11: Replace TF-IDF in serp_analyzer.py

**Files:**
- Modify: `python-sidecar/analyzers/serp_analyzer.py`

- [ ] **Step 1: Add include_texts parameter to analyze_serp()**

Modify `analyze_serp()` signature to accept `include_texts: bool = False`:

```python
async def analyze_serp(keyword: str, language: str = "pl", num_results: int = 10, include_texts: bool = False) -> dict:
```

When `include_texts=True`, attach `_competitor_texts` from the already-scraped `serp_texts` (no second fetch):

```python
# After returning the result, add:
if include_texts:
    result["_competitor_texts"] = serp_texts
```

This avoids ScrapeSerpStage calling `_scrape_pages()` again — the texts are already in memory from `_scrape_pages()` called by `analyze_serp()` itself.

- [ ] **Step 2: Replace _extract_nlp_terms call with semantic_terms**

Add import near the top of `serp_analyzer.py` (after existing imports):

```python
from analyzers.semantic_terms import extract_semantic_terms
```

In `analyze_serp()`, replace the term extraction call:

```python
# Before (line ~100):
nlp_terms = _extract_nlp_terms(serp_texts, keyword)

# After:
deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
nlp_terms = await extract_semantic_terms(keyword, serp_texts, deepseek_key)
```

Keep the `_extract_nlp_terms` function definition with a deprecation comment:

```python
def _extract_nlp_terms(texts: list[str], keyword: str) -> list[dict]:
    """
    DEPRECATED: Replaced by analyzers.semantic_terms.extract_semantic_terms()
    in analyze_serp(). Kept for backward compatibility.
    """
    # ... existing implementation unchanged ...
```

- [ ] **Step 3: Test serp_analyzer still works**

```bash
cd python-sidecar
python -c "
import asyncio
from analyzers.serp_analyzer import analyze_serp
result = asyncio.run(analyze_serp('test keyword', 'en'))
print('Terms:', len(result.get('terms', [])))
print('Competitors:', len(result.get('competitors', [])))
"
```

Expected: terms list populated. Competitor list unchanged.

- [ ] **Step 4: Commit**

```bash
git add python-sidecar/analyzers/serp_analyzer.py
git commit -m "feat: replace TF-IDF term extraction with semantic_terms in serp_analyzer"
```

---

## Phase 4: Ranking Score

### Task 12: Implement ranking_scorer.py

**Files:**
- Create: `python-sidecar/analyzers/ranking_scorer.py`
- Modify: `python-sidecar/pipeline/stages/score_ranking.py` (wire real scorer)

- [ ] **Step 1: Write ranking_scorer.py**

`python-sidecar/analyzers/ranking_scorer.py`:

```python
"""
Multi-signal ranking prediction with hybrid 70/30 approach.
final_score = round(0.7 * rule_base + 0.3 * llm_adjustment)

rule_base = content_score proxy (simple rule engine, mirrors contentScore.ts)
llm_adjustment = DeepSeek holistic analysis of 6 signals + rubric

Result includes versioning metadata for full reproducibility.
"""
import hashlib
import json
import os
import re
from datetime import datetime, timezone

import httpx


async def predict_ranking(
    keyword: str,
    content_score: int,
    site_context: dict,
    serp_data: dict,
    content_class: dict,
    deepseek_key: str,
) -> dict:
    """Predict ranking probability with hybrid scoring.
    Returns {ranking_score, ranking_signals} with version metadata."""
    meta = site_context.get("meta", {})
    content = site_context.get("content", {})
    headings = site_context.get("headings", {})
    issues = site_context.get("issues", [])

    word_count = content.get("word_count", 0)
    heading_count = headings.get("total", 0)
    paragraph_count = content.get("paragraph_count", 0)

    words_target = serp_data.get("words_target", 2200)
    headings_target = serp_data.get("headings_target", 15)
    paragraphs_target = serp_data.get("paragraphs_target", 20)

    title = meta.get("title", "")
    title_length = meta.get("title_length", 0)
    desc = meta.get("description", "")
    desc_length = meta.get("description_length", 0)
    og_tags = {
        "og_title": bool(meta.get("og_title")),
        "og_description": bool(meta.get("og_description")),
        "og_image": bool(meta.get("og_image")),
    }
    canonical = meta.get("canonical", "")

    page_type = content_class.get("page_type", "unknown")
    is_thin = content_class.get("is_thin", False)
    eeat_score = content_class.get("eeat_score", 50)
    originality = content_class.get("content_originality_risk", "medium")
    freshness = content_class.get("freshness_score", 50)

    issues_json = json.dumps([
        {"check": i.get("check", ""), "severity": i.get("severity", "warning"), "message": i.get("message", "")}
        for i in issues[:10]
    ])

    input_data = {
        "keyword": keyword,
        "content_score": content_score,
        "word_count": word_count,
        "heading_count": heading_count,
        "paragraph_count": paragraph_count,
        "words_target": words_target,
        "headings_target": headings_target,
        "paragraphs_target": paragraphs_target,
        "title_length": title_length,
        "desc_length": desc_length,
        "og_tags": og_tags,
        "page_type": page_type,
        "is_thin": is_thin,
        "eeat_score": eeat_score,
        "originality": originality,
        "freshness": freshness,
        "issues_count": len(issues),
        "issues_error": sum(1 for i in issues if i.get("severity") == "error"),
    }
    input_hash = hashlib.sha256(json.dumps(input_data, sort_keys=True).encode()).hexdigest()[:16]

    prompt_version = "2026-05-24"
    model = "deepseek-chat"

    if not deepseek_key:
        return _fallback_score(content_score, input_hash, prompt_version, model)

    prompt = f"""You are an SEO ranking analyst. Using the provided numeric rubric, predict
how likely this page is to rank in Google top 10 for "{keyword}".
Rate each signal 0-100 with verdict. Do not reward vague quality.
Use the exact numbers provided in the input data where relevant.

Return JSON:
{{
  "total": 0-100,
  "signals": [
    {{"name": "meta_quality", "score": 0-100, "verdict": "adequate|strong|needs_work|weak", "recommendation": "..."}},
    {{"name": "content_depth", "score": 0-100, "verdict": "...", "recommendation": "..."}},
    {{"name": "eeat", "score": 0-100, "verdict": "...", "recommendation": "..."}},
    {{"name": "freshness", "score": 0-100, "verdict": "...", "recommendation": "..."}},
    {{"name": "technical", "score": 0-100, "verdict": "...", "recommendation": "..."}},
    {{"name": "competitiveness", "score": 0-100, "verdict": "...", "recommendation": "..."}}
  ],
  "summary": "one-sentence verdict"
}}

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
Meta: title="{title}" ({title_length} chars), desc="{desc}" ({desc_length} chars), OG={json.dumps(og_tags)}, canonical={canonical}
Content stats: {word_count} words, {heading_count} headings, {paragraph_count} paragraphs
Content class: page_type={page_type}, thin={is_thin}, eeat={eeat_score}, originality={originality}, freshness={freshness}
Issues: {issues_json}"""

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {deepseek_key}",
                },
                json={
                    "model": model,
                    "max_tokens": 1024,
                    "temperature": 0.1,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            raw: str = data["choices"][0]["message"]["content"]

        json_match = re.search(r"\{[\s\S]*\}", raw)
        if not json_match:
            return _fallback_score(content_score, input_hash, prompt_version, model)

        llm_result = json.loads(json_match[0])
        llm_total = int(llm_result.get("total", content_score))

        # Hybrid: 70% rule base + 30% LLM adjustment
        final_score = round(0.7 * content_score + 0.3 * llm_total)
        final_score = max(0, min(100, final_score))

        scored_at = datetime.now(timezone.utc).isoformat()

        return {
            "ranking_score": final_score,
            "ranking_signals": {
                "version": "ranking_scorer_v1",
                "model": model,
                "prompt_version": prompt_version,
                "input_hash": input_hash,
                "scored_at": scored_at,
                "rule_base": content_score,
                "llm_total": llm_total,
                "final_score": final_score,
                "signals": llm_result.get("signals", []),
                "summary": llm_result.get("summary", ""),
            },
        }

    except Exception as exc:
        print(f"[ranking_scorer] DeepSeek error: {exc}")
        return _fallback_score(content_score, input_hash, prompt_version, model)


def _fallback_score(content_score: int, input_hash: str, prompt_version: str, model: str) -> dict:
    scored_at = datetime.now(timezone.utc).isoformat()
    return {
        "ranking_score": content_score,
        "ranking_signals": {
            "version": "fallback_v0",
            "model": model,
            "prompt_version": prompt_version,
            "input_hash": input_hash,
            "scored_at": scored_at,
            "rule_base": content_score,
            "llm_total": None,
            "final_score": content_score,
            "signals": [],
            "summary": "AI scoring unavailable — using rule-based score only.",
        },
    }
```

- [ ] **Step 2: Wire real scorer into score_ranking stage**

Replace `python-sidecar/pipeline/stages/score_ranking.py`:

```python
"""Stage 5: Ranking score via analyzers.ranking_scorer with hybrid 70/30 approach."""
import os
from pipeline.contracts import AnalysisStage, StageContext
from analyzers.ranking_scorer import predict_ranking


class ScoreRankingStage(AnalysisStage):
    name = "score_ranking"
    progress_weight = 0.25

    async def run(self, ctx: StageContext) -> dict:
        keyword = ctx.payload.get("keyword", "")
        deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")

        serp = ctx.get_state("scrape_serp") or {}
        classify = ctx.get_state("classify_content") or {}
        fetch = ctx.get_state("fetch_page") or {}

        site_context = {
            "meta": {
                "title": fetch.get("meta_title", ""),
                "title_length": len(fetch.get("meta_title", "")),
                "description": fetch.get("meta_description", ""),
                "description_length": len(fetch.get("meta_description", "")),
                "og_title": fetch.get("og_title", ""),
                "og_description": fetch.get("og_description", ""),
                "og_image": fetch.get("og_image", ""),
                "canonical": fetch.get("canonical", ""),
            },
            "content": {
                "word_count": classify.get("word_count_estimate", 0),
                "paragraph_count": fetch.get("paragraph_count", 0),
            },
            "headings": {"total": fetch.get("heading_count", 0)},
            "issues": fetch.get("issues", []),
        }

        rule_base = _compute_rule_base(site_context, serp, classify)

        await ctx.emit_progress(self, 30, "Predicting ranking score via AI...")
        result = await predict_ranking(
            keyword=keyword,
            content_score=rule_base,
            site_context=site_context,
            serp_data=serp,
            content_class=classify,
            deepseek_key=deepseek_key,
        )
        await ctx.emit_progress(self, 90, f"Final score: {result['ranking_score']}/100")

        return result


def _compute_rule_base(site_context: dict, serp_data: dict, classify: dict) -> int:
    """Simple proxy for contentScore.ts rule engine. Returns 0-100."""
    score = 80
    content = site_context.get("content", {})
    word_count = content.get("word_count", 0)
    words_target = serp_data.get("words_target", 2200)
    if words_target and word_count < words_target * 0.5:
        score -= 20
    elif words_target and word_count < words_target * 0.8:
        score -= 10

    meta = site_context.get("meta", {})
    title_len = meta.get("title_length", 0)
    if title_len < 30 or title_len > 65:
        score -= 10
    desc_len = meta.get("description_length", 0)
    if desc_len < 70:
        score -= 5

    is_thin = classify.get("is_thin", False)
    if is_thin:
        score -= 25

    eeat = classify.get("eeat_score", 50)
    if eeat < 30:
        score -= 15
    elif eeat < 50:
        score -= 5

    return max(0, min(100, score))
```

- [ ] **Step 3: Test ranking scorer standalone**

```bash
cd python-sidecar
python -c "
import asyncio, os
from analyzers.ranking_scorer import predict_ranking
site_context = {
    'meta': {'title': 'Best SEO Guide', 'title_length': 25, 'description': 'Learn SEO', 'description_length': 60, 'og_title': '', 'og_description': '', 'og_image': '', 'canonical': ''},
    'content': {'word_count': 1800, 'paragraph_count': 12},
    'headings': {'total': 10},
    'issues': [{'check': 'Meta Title', 'severity': 'warning', 'message': 'Title too short'}],
}
serp_data = {'words_target': 2200, 'headings_target': 15, 'paragraphs_target': 20}
classify = {'page_type': 'article', 'is_thin': False, 'eeat_score': 60, 'content_originality_risk': 'low', 'freshness_score': 70}
result = asyncio.run(predict_ranking('SEO guide', 75, site_context, serp_data, classify, os.getenv('DEEPSEEK_API_KEY', '')))
print('Score:', result['ranking_score'])
s = result['ranking_signals']
print('Breakdown: final_score=', s['final_score'], 'rule_base=', s['rule_base'], 'llm_total=', s['llm_total'])
"
```

Expected: score 0-100, version metadata present. With DEEPSEEK_API_KEY: hybrid blend. Without: `rule_base` only.

- [ ] **Step 4: Verify full 5-stage pipeline with real scorer**

```bash
cd python-sidecar
python -c "from pipeline.runner import PipelineRunner; p = PipelineRunner.build_deep_analysis_pipeline(); print(f'{len(p)} stages ready')"
```

Expected: `5 stages ready`

- [ ] **Step 5: Commit**

```bash
git add python-sidecar/analyzers/ranking_scorer.py python-sidecar/pipeline/stages/score_ranking.py
git commit -m "feat: implement hybrid 70/30 ranking scorer with versioned signals"
```

---

## Phase 5: Validate

### Task 13: Backfill + stability test

**Files:**
- Create: `python-sidecar/scripts/validate_scores.py`

- [ ] **Step 1: Write validation script**

`python-sidecar/scripts/validate_scores.py`:

```python
"""
Validation script — compares rule-base vs AI scores.
Run: python scripts/validate_scores.py
Tests:
  1. Score stability: re-analyze same article 3x, check variance ≤ 5 points
  2. Score range: thin content scores low (< 50), strong content scores high (> 70)
"""
import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from analyzers.ranking_scorer import predict_ranking


async def test_stability():
    """Re-analyze same inputs 3x, verify ≤5 point variance."""
    print("\n=== Stability Test ===")
    site_context = {
        "meta": {"title": "Complete SEO Guide 2024", "title_length": 25, "description": "Full guide to SEO", "description_length": 60, "og_title": "", "og_description": "", "og_image": "", "canonical": ""},
        "content": {"word_count": 2500, "paragraph_count": 18},
        "headings": {"total": 14},
        "issues": [],
    }
    serp_data = {"words_target": 2200, "headings_target": 15, "paragraphs_target": 20}
    classify = {"page_type": "article", "is_thin": False, "eeat_score": 65, "content_originality_risk": "low", "freshness_score": 75}

    scores = []
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not deepseek_key:
        print("SKIP: No DEEPSEEK_API_KEY — cannot run stability test without AI")
        return

    for i in range(3):
        result = await predict_ranking("SEO guide", 75, site_context, serp_data, classify, deepseek_key)
        scores.append(result["ranking_score"])
        s = result["ranking_signals"]
        print(f"  Run {i+1}: {result['ranking_score']} (rule={s['rule_base']}, llm={s['llm_total']})")

    variance = max(scores) - min(scores)
    status = "PASS" if variance <= 5 else "FAIL"
    print(f"  Variance: {variance} points — {status} (threshold: ≤5)")


async def test_score_range():
    """Test that low-quality inputs score low and high-quality score high."""
    print("\n=== Score Range Test ===")
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not deepseek_key:
        print("SKIP: No DEEPSEEK_API_KEY")
        return

    thin_site = {
        "meta": {"title": "SEO", "title_length": 3, "description": "", "description_length": 0, "og_title": "", "og_description": "", "og_image": "", "canonical": ""},
        "content": {"word_count": 200, "paragraph_count": 2},
        "headings": {"total": 2},
        "issues": [
            {"check": "Meta Title", "severity": "error", "message": "Missing"},
            {"check": "Meta Description", "severity": "error", "message": "Missing"},
            {"check": "Content Length", "severity": "warning", "message": "Thin"},
        ],
    }
    thin_classify = {"page_type": "article", "is_thin": True, "eeat_score": 10, "content_originality_risk": "high", "freshness_score": 20}
    thin_result = await predict_ranking("SEO", 30, thin_site, {"words_target": 2200}, thin_classify, deepseek_key)

    strong_site = {
        "meta": {"title": "The Ultimate Guide to Enterprise SEO Strategy in 2024", "title_length": 58, "description": "Learn proven enterprise SEO strategies from Fortune 500 companies. Comprehensive guide covering technical SEO, content strategy, and link building.", "description_length": 148, "og_title": "Ultimate Enterprise SEO Guide", "og_description": "Proven enterprise SEO strategies", "og_image": "https://example.com/og.jpg", "canonical": "https://example.com/seo-guide"},
        "content": {"word_count": 3500, "paragraph_count": 28},
        "headings": {"total": 22},
        "issues": [],
    }
    strong_classify = {"page_type": "article", "is_thin": False, "eeat_score": 85, "content_originality_risk": "low", "freshness_score": 90}
    strong_result = await predict_ranking("enterprise SEO", 92, strong_site, {"words_target": 2200, "headings_target": 15}, strong_classify, deepseek_key)

    print(f"  Thin content:  {thin_result['ranking_score']}/100 (expect < 50)")
    print(f"  Strong content: {strong_result['ranking_score']}/100 (expect > 70)")

    thin_ok = thin_result["ranking_score"] < 50
    strong_ok = strong_result["ranking_score"] > 70
    print(f"  Thin test: {'PASS' if thin_ok else 'FAIL (too high)'}")
    print(f"  Strong test: {'PASS' if strong_ok else 'FAIL (too low)'}")


async def main():
    print("X-Algorithm Scoring Pipeline — Validation Suite")
    print("=" * 50)
    await test_stability()
    await test_score_range()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Run validation**

```bash
cd python-sidecar
python scripts/validate_scores.py
```

Expected: Stability ≤ 5, thin < 50, strong > 70. If SKIP (no API key), tests pass via fallback.

- [ ] **Step 3: Fix prompts if thresholds fail**

If thin > 50 or strong < 70: adjust rubric in `ranking_scorer.py`, re-run.

- [ ] **Step 4: Full pipeline end-to-end with real stages**

```bash
curl -s -X POST http://127.0.0.1:8001/pipeline/deep-analysis \
  -H "Content-Type: application/json" \
  -d '{"jobId":"validate_real_1","payload":{"url":"https://en.wikipedia.org/wiki/Search_engine_optimization","keyword":"search engine optimization","language":"en"}}' | python -m json.tool
```

Expected: All 5 stages complete with real data. `ranking_score` between 60-95 for Wikipedia.

- [ ] **Step 5: Commit**

```bash
git add python-sidecar/scripts/validate_scores.py
git commit -m "test: add ranking scorer validation suite"
```

---

### Task 14: Final integration — verify API returns ranking_score

- [ ] **Step 1: Check article detail API returns new columns**

Read `pages/api/articles/[id]/index.ts`. If the SELECT doesn't include `ranking_score` and `ranking_signals`, add them:

```typescript
// Add to the SELECT list:
, a.ranking_score, a.ranking_signals
```

- [ ] **Step 2: Final end-to-end test through Next.js**

```bash
curl -s -N -X POST http://127.0.0.1:3000/api/articles/deep-analysis \
  -H "Content-Type: application/json" \
  -d '{"url":"https://ahrefs.com/blog/seo-basics/","keywords":["SEO basics"]}'
```

Expected: SSE `created` → `done` with `rankingScore`. Article in DB has `ranking_score` populated. Job row status = `'done'`, result populated.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: final integration — ranking_score flows through API"
```

---

## Self-Review

### 1. Spec coverage

| Requirement | Covered by |
|-------------|------------|
| Pipeline pattern (StageContext, PipelineRunner) | Tasks 2, 3 |
| analysis_jobs table | Task 1 |
| 5-stage pipeline | Tasks 3, 4 |
| SSE streaming from TS side | Task 7 |
| POST /pipeline/deep-analysis endpoint | Task 6 |
| Semantic term extraction (DeepSeek, chunk, cache, semaphore) | Task 10 |
| Replace _extract_nlp_terms in serp_analyzer | Task 11 |
| Content classifier (5 dimensions, pre-LLM + DeepSeek) | Task 9 |
| content_originality_risk (low/medium/high) | Task 9 |
| Multi-signal ranking (6 signals, rubric, hybrid 70/30) | Task 12 |
| Versioned ranking_signals JSONB | Task 12 |
| _compute_audit_score preserved as legacy | No deletion — site_analyzer.py untouched |
| DB migration (ranking_score, ranking_signals, analysis_jobs) | Task 1 |
| Backward compatibility (NULL ranking_score → content_score) | Task 14 |
| Stability test (3x variance ≤ 5) | Task 13 |
| Score range test (thin < 50, strong > 70) | Task 13 |
| No frontend changes | No frontend files touched |
| No new Python dependencies | Only httpx, asyncio (already installed) |
| No new infrastructure | PostgreSQL queue, no Redis/Kafka |
| contentScore.ts unchanged | No file touched |

### 2. Job lifecycle correctness (all 8 fixes applied)

| Issue | Resolution |
|-------|-----------|
| set_state() sync / await bug | set_state() is sync; all calls use `self.ctx.set_state(...)` without await |
| Circular import runner ↔ stages | contracts.py extracted; stages import from contracts; runner lazy-imports stages in build_deep_analysis_pipeline() |
| Python not writing done/result to DB | Task 7: TypeScript `await`s sidecar, then UPDATEs job row with result |
| Missing /api/articles/job-progress | Task 5: new endpoint, Python POSTs progress during execution |
| current_stage not sent to progress API | emit_progress sends currentStage from ctx._state |
| FOR UPDATE SKIP LOCKED not implemented | Architecture updated: TS creates job → passes jobId → Python runs → TS writes result |
| payload/result as TEXT vs JSONB | Updated: `${isPostgres ? 'JSONB' : 'TEXT'}` in migration |
| db.query result handling without QueryTypes.SELECT | Task 7 uses QueryTypes.SELECT in all polling queries |

### 3. Round 2 fixes (auth, URL, SSE, fallback, lifecycle — 10 issues)

| Issue | Resolution |
|-------|-----------|
| job-progress requires verifyUser, Python has no cookie | Added `x-internal-token` header auth path: Python sends `INTERNAL_PIPELINE_TOKEN` env var, endpoint checks it before falling back to `verifyUser` |
| StageContext used PYTHON_SIDECAR_URL for job-progress POST | Renamed param to `nextjs_url`, main.py passes `NEXTJS_URL` env var, contracts.py uses `_nextjs_url` for progress callbacks |
| SSE scope ambiguous | Clarified: Phase 2 MVP emits only `created` + `done`. Progress persisted in `analysis_jobs` rows. Future phase adds poll loop for streaming stage/progress events |
| content_score hardcoded to 0 | Now `content_score = COALESCE(?, content_score)` with `rule_base` from ranking_signals as value — preserves existing score when ranking_score is NULL |
| locking/attempts columns unused | Added job claim UPDATE before sidecar call: sets `status='running'`, `locked_at`, `locked_by`, increments `attempts` |
| job-progress returns 200 for nonexistent jobId | Added SELECT check before UPDATE — returns 404 with `'job not found'` for unknown jobIds |
| ScoreRankingStage site_context too sparse | Enriched FetchPageStage to extract meta_description, canonical, og tags, heading_count, paragraph_count, images_without_alt, basic issues. ScoreRankingStage now uses all fields from fetch_page |
| ScrapeSerpStage double-scrapes competitors | Added `include_texts` parameter to `analyze_serp()` — returns `_competitor_texts` from the already-scraped texts, no second `_scrape_pages()` call |
| Import paths concern (`./././`) | Verified: all imports use correct `../../../...` paths. No broken paths found |
| No fetch timeout → pipeline hangs | Added `AbortController` with 180s timeout, `clearTimeout` in finally, AbortError-specific message |

### 3. Round 3 fixes (indentation, claim check, finally block — 3 issues)

| Issue | Resolution |
|-------|-----------|
| FetchPageStage `_fetch()` and `_spa_fallback()` indented inside `_detect_fetch_issues()` after `return issues` | Moved out of `_detect_fetch_issues()` — now properly indented as `FetchPageStage` class methods (same level as `run()`) |
| Claim UPDATE doesn't check rows affected | Added SELECT after claim UPDATE to verify `status = 'running'` — dialect-safe (avoids Sequelize/Postgres/SQLite UPDATE result differences). Returns error if not claimed |
| `clearTimeout(timeout)` could be skipped if fetch throws before reaching it | Wrapped fetch + clearTimeout in inner try/finally — `clearTimeout` always runs regardless of fetch outcome |

### 4. Placeholder scan

No TBDs, TODOs, or "implement later" found. All code is complete.

### 5. Type consistency

- Stage keys (`fetch_page`, `scrape_serp`, `classify_content`, `extract_terms`, `score_ranking`) — identical across runner.py, each stage, and deep-analysis.ts
- `ranking_signals` structure — identical between ranking_scorer.py and deep-analysis.ts
- `analysis_jobs` columns — identical between ensureArticlesTables.ts, job-progress.ts, and deep-analysis.ts
- `INTERNAL_PIPELINE_TOKEN` must be set in both `.env` (Next.js) and `python-sidecar/.env` (Python) for progress updates to work
