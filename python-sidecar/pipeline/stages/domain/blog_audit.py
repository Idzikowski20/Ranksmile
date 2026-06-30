"""BlogAuditStage — fetch each blog post, compute a no-LLM triage score (P3d)."""
import asyncio
import os
import time

import httpx

from pipeline.contracts import AnalysisStage, StageContext
from pipeline.stages.domain.page_signals import extract_page_signals
from pipeline.stages.domain.triage_scorer import score_triage

MAX_POSTS = 100
CONCURRENCY = 8
FETCH_TIMEOUT = 15.0
UA = "Mozilla/5.0 (compatible; SerpBearBot/1.0)"
NEXTJS_URL = os.getenv("NEXTJS_URL", "http://127.0.0.1:3000")


def _status_from_exc(exc: Exception) -> str:
    if isinstance(exc, httpx.TimeoutException):
        return "TIMEOUT"
    return "ERROR"


async def _spa_render(url: str) -> str | None:
    """JS-render a URL via the Next.js headless endpoint (for SPA shells)."""
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            resp = await client.post(
                f"{NEXTJS_URL}/api/render-page",
                json={"url": url, "timeout": 15000},
                headers={"x-internal-token": os.getenv("INTERNAL_PIPELINE_TOKEN", "")},
            )
            resp.raise_for_status()
            html = resp.json().get("html")
            if html:
                print(f"[blog_audit] SPA fallback success for {url}")
                return html
    except Exception as exc:  # noqa: BLE001
        print(f"[blog_audit] SPA fallback failed for {url}: {exc}")
    return None


async def _audit_one(client: httpx.AsyncClient, url: str) -> dict:
    start = time.monotonic()
    try:
        r = await client.get(url, headers={"User-Agent": UA}, follow_redirects=True)
        duration_ms = int((time.monotonic() - start) * 1000)
        if r.status_code == 403:
            return {"url": url, "fetch_status": "HTTP_403", "duration_ms": duration_ms}
        if r.status_code == 404:
            return {"url": url, "fetch_status": "HTTP_404", "duration_ms": duration_ms}
        if r.status_code >= 400:
            return {"url": url, "fetch_status": "ERROR", "duration_ms": duration_ms}
        signals = extract_page_signals(r.text, url)
        # SPA sites return the same shell for every route over plain HTTP, so all pages
        # would score identically. Re-render thin pages so each gets its real content.
        if signals.get("word_count", 0) < 300:
            rendered = await _spa_render(url)
            if rendered:
                signals = extract_page_signals(rendered, url)
        score = score_triage(signals)
        return {
            "url": url,
            "path": signals["path"],
            "title": signals["title"],
            "score": score,
            "word_count": signals["word_count"],
            "signals": signals,
            "content_hash": signals["content_hash"],
            "fetch_status": "OK",
            "duration_ms": duration_ms,
        }
    except Exception as exc:  # noqa: BLE001 — per-post isolation, never fail the stage
        return {"url": url, "fetch_status": _status_from_exc(exc),
                "duration_ms": int((time.monotonic() - start) * 1000)}


class BlogAuditStage(AnalysisStage):
    name = "blog_audit"
    progress_weight = 0.25

    async def run(self, ctx: StageContext) -> dict:
        all_urls: list[str] = ctx.payload.get("blog_urls", []) or []
        total = len(all_urls)
        urls = all_urls[:MAX_POSTS]
        if total > MAX_POSTS:
            print(f"[blog_audit] {total} posts found, auditing first {MAX_POSTS}")

        await ctx.emit_progress(self, 5, f"Auditing {len(urls)} blog posts")

        audits: list[dict] = []
        sem = asyncio.Semaphore(CONCURRENCY)
        done = 0

        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT) as client:
            async def worker(u: str) -> None:
                nonlocal done
                async with sem:
                    result = await _audit_one(client, u)
                audits.append(result)
                done += 1
                if done % 10 == 0 or done == len(urls):
                    pct = 5 + int(90 * done / max(1, len(urls)))
                    await ctx.emit_progress(self, pct, f"Audited {done}/{len(urls)} posts")

            await asyncio.gather(*(worker(u) for u in urls))

        scored = [a for a in audits if a.get("fetch_status") == "OK"]
        counts = {"audited": len(scored), "skipped": len(audits) - len(scored), "total": total}
        ctx.set_state("page_audits", audits)
        ctx.set_state("audit_counts", counts)
        await ctx.emit_progress(self, 100, f"Audited {counts['audited']}, skipped {counts['skipped']}")
        return {"page_audits": audits, "audit_counts": counts}
