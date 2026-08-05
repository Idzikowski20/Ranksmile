"""Domain-setup pipeline runner — mirrors pipeline/runner.py.

Builds the 4-stage domain pipeline (keywords, topics, competitors, recommendations),
wraps each stage in a per-stage timeout, and posts a terminal done/failed callback
to /api/articles/job-progress when the pipeline finishes.
"""
import asyncio
import os

import httpx

from pipeline.contracts import AnalysisStage, StageContext

# Per-stage wall-clock timeouts (seconds)
TIMEOUTS: dict[str, int] = {
    "keywords": 120,
    "topics": 300,
    "competitors": 600,
    "blog_audit": 900,
    "recommendations": 300,
}


def build_domain_setup_pipeline() -> list[AnalysisStage]:
    """Lazy imports — avoids circular deps (stages import from contracts, not runner)."""
    from pipeline.stages.domain.keywords import KeywordsStage
    from pipeline.stages.domain.topics import TopicsStage
    from pipeline.stages.domain.competitors import CompetitorsStage
    from pipeline.stages.domain.blog_audit import BlogAuditStage
    from pipeline.stages.domain.recommendations import RecommendationsStage

    return [
        KeywordsStage(),
        TopicsStage(),
        CompetitorsStage(),
        BlogAuditStage(),
        RecommendationsStage(),
    ]


def build_domain_ctx(job_id: str, payload: dict, nextjs_url: str = "") -> StageContext:
    return StageContext(job_id, payload, nextjs_url)


async def post_terminal(
    nextjs_url: str,
    job_id: str,
    status: str,
    result: dict | None = None,
    error: str | None = None,
) -> None:
    """POST a terminal done/failed callback to Node's /api/articles/job-progress.

    Mirrors StageContext.emit_progress's httpx client + x-internal-token header.
    Best-effort — logs on failure, never raises."""
    url = f"{nextjs_url.rstrip('/')}/api/articles/job-progress"
    body: dict = {
        "jobId": job_id,
        "status": status,
        "result": result,
        "message": error or (status if status == "done" else ""),
    }
    if not nextjs_url:
        print(f"[domain_runner] terminal {status} for {job_id}: {error or 'done'}")
        return

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "x-internal-token": os.environ.get("INTERNAL_PIPELINE_TOKEN", ""),
                },
                json=body,
            )
            if resp.status_code >= 400:
                print(
                    f"[domain_runner] terminal callback HTTP {resp.status_code}: {resp.text[:200]}"
                )
    except Exception as exc:
        print(f"[domain_runner] terminal callback failed: {type(exc).__name__}: {exc}")


async def post_progress(nextjs_url: str, job_id: str, total_progress: int, message: str) -> None:
    if not nextjs_url:
        return
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(
                f"{nextjs_url.rstrip('/')}/api/articles/job-progress",
                headers={"Content-Type": "application/json", "x-internal-token": os.environ.get("INTERNAL_PIPELINE_TOKEN", "")},
                json={"jobId": job_id, "currentStage": "compiled_write_plan", "stageProgress": total_progress, "totalProgress": total_progress, "message": message},
            )
    except Exception as exc:
        print(f"[domain_runner] progress callback failed: {type(exc).__name__}: {exc}")


async def run_domain_setup(job_id: str, payload: dict, nextjs_url: str) -> None:
    """Execute the 4-stage domain pipeline with per-stage timeouts.

    On success: assembles result dict and calls post_terminal('done', result=...).
    On any exception or timeout: calls post_terminal('failed', error=...).
    Designed to run as an asyncio background task (never raises).
    """
    stages = build_domain_setup_pipeline()
    ctx = build_domain_ctx(job_id, payload, nextjs_url)
    current_stage_name = "unknown"

    try:
        for stage in stages:
            current_stage_name = stage.name
            ctx.set_state("current_stage", stage.name)
            await ctx.emit_progress(stage, 0, f"{stage.name} started")

            timeout = TIMEOUTS.get(stage.name, 300)
            # Each stage writes its own state (set_state("keywords"/"topics"/…)). The runner
            # must NOT mirror the result under stage.name — stage.name equals the state key,
            # so it would overwrite the list with the {key: list} result dict and break the
            # next stage (and the final assembly below).
            await asyncio.wait_for(stage.run(ctx), timeout=timeout)

            ctx.total_progress += stage.progress_weight * 100
            await ctx.emit_progress(stage, 100, f"{stage.name} done")

        # Assemble final result from ctx state
        result: dict = {
            "keywords": ctx.get_state("keywords") or [],
            "topics": ctx.get_state("topics") or [],
            "competitors": ctx.get_state("competitors") or [],
            "recommendations": ctx.get_state("recommendations") or [],
            "page_audits": ctx.get_state("page_audits") or [],
            "audit_counts": ctx.get_state("audit_counts") or {"audited": 0, "skipped": 0, "total": 0},
        }
        await post_terminal(nextjs_url, job_id, "done", result=result)

    except asyncio.TimeoutError as exc:
        error_msg = f"{current_stage_name} TimeoutError: stage exceeded {TIMEOUTS.get(current_stage_name, 300)}s"
        print(f"[domain_runner] {error_msg}")
        await post_terminal(nextjs_url, job_id, "failed", error=error_msg)

    except Exception as exc:
        error_msg = f"{current_stage_name} {type(exc).__name__}: {exc}"
        print(f"[domain_runner] pipeline error: {error_msg}")
        await post_terminal(nextjs_url, job_id, "failed", error=error_msg)
