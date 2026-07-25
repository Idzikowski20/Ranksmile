"""BlogAuditStage ? BFS crawl domain pages and extract on-page signals (P3d)."""
import asyncio
import os
import time
from collections import deque
from urllib.parse import urljoin, urlparse

import httpx

from pipeline.contracts import AnalysisStage, StageContext
from pipeline.ssrf_guard import assert_public_url
from pipeline.stages.domain.page_signals import extract_page_signals

MAX_CRAWL_URLS_DEFAULT = 100
CONCURRENCY = 8
FETCH_TIMEOUT = 15.0
UA = "Mozilla/5.0 (compatible; RanksmileBot/1.0)"
from service_urls import nextjs_url
PERMANENT_REDIRECT_CODES = {301, 308}


def _status_from_exc(exc: Exception) -> str:
    if isinstance(exc, httpx.TimeoutException):
        return "TIMEOUT"
    return "ERROR"


def _normalize_url(url: str) -> str:
    return url.split("#")[0].split("?")[0].rstrip("/") or url


def _same_host(url: str, host: str) -> bool:
    try:
        return urlparse(url).netloc == host
    except ValueError:
        return False


def _seed_urls(blog_urls: list[str], domain: str) -> list[str]:
    base = domain if domain.startswith("http") else f"https://{domain}"
    base = base.rstrip("/")
    seen: set[str] = set()
    out: list[str] = []

    def push(raw: str) -> None:
        u = raw if raw.startswith("http") else f"{base}{raw if raw.startswith('/') else '/' + raw}"
        key = _normalize_url(u)
        if key in seen:
            return
        seen.add(key)
        out.append(u)

    push(f"{base}/")
    for u in blog_urls:
        push(u)
    return out


async def _spa_render(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            resp = await client.post(
                f"{nextjs_url()}/api/render-page",
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


async def _audit_one(client: httpx.AsyncClient, url: str, host: str) -> tuple[dict, list[str]]:
    """Returns audit row and discovered internal URLs to enqueue."""
    start = time.monotonic()
    discovered: list[str] = []
    try:
        assert_public_url(url)
        r = await client.get(
            url,
            headers={"User-Agent": UA},
            follow_redirects=False,
        )
        duration_ms = int((time.monotonic() - start) * 1000)

        if r.status_code in PERMANENT_REDIRECT_CODES:
            target = r.headers.get("location", "")
            resolved = urljoin(url, target) if target else ""
            signals = {
                "redirect_target": resolved[:2000],
                "redirect_status": r.status_code,
            }
            if resolved and _same_host(resolved, host):
                discovered.append(resolved)
            return {
                "url": url,
                "fetch_status": "REDIRECT_301",
                "duration_ms": duration_ms,
                "signals": signals,
            }, discovered

        if 300 <= r.status_code < 400:
            target = r.headers.get("location", "")
            resolved = urljoin(url, target) if target else ""
            if resolved and _same_host(resolved, host):
                discovered.append(resolved)
            return {
                "url": url,
                "fetch_status": f"REDIRECT_{r.status_code}",
                "duration_ms": duration_ms,
                "signals": {"redirect_target": resolved[:2000], "redirect_status": r.status_code},
            }, discovered

        if r.status_code == 403:
            return {"url": url, "fetch_status": "HTTP_403", "duration_ms": duration_ms}, discovered
        if r.status_code == 404:
            return {"url": url, "fetch_status": "HTTP_404", "duration_ms": duration_ms}, discovered
        if r.status_code >= 400:
            return {"url": url, "fetch_status": "ERROR", "duration_ms": duration_ms}, discovered

        signals = extract_page_signals(r.text, url)
        if signals.get("word_count", 0) < 300:
            rendered = await _spa_render(url)
            if rendered:
                signals = extract_page_signals(rendered, url)

        for href in signals.get("outbound_internal_hrefs") or []:
            if _same_host(href, host):
                discovered.append(href)

        score = 0
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
        }, discovered

    except Exception as exc:  # noqa: BLE001
        return {
            "url": url,
            "fetch_status": _status_from_exc(exc),
            "duration_ms": int((time.monotonic() - start) * 1000),
        }, discovered


class BlogAuditStage(AnalysisStage):
    name = "blog_audit"
    progress_weight = 0.25

    async def run(self, ctx: StageContext) -> dict:
        all_urls: list[str] = ctx.payload.get("blog_urls", []) or []
        domain: str = ctx.payload.get("domain", "") or ""
        host = urlparse(domain if domain.startswith("http") else f"https://{domain}").netloc

        seeds = _seed_urls(all_urls, domain)
        queue: deque[str] = deque(seeds)
        visited: set[str] = set()
        audits: list[dict] = []
        sem = asyncio.Semaphore(CONCURRENCY)
        done = 0
        max_urls = int((ctx.payload.get("limits") or {}).get("site_audit_pages") or MAX_CRAWL_URLS_DEFAULT)
        max_urls = max(1, min(max_urls, 1000))

        await ctx.emit_progress(self, 5, f"BFS crawl starting (max {max_urls} URLs)")

        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT) as client:
            while queue and len(visited) < max_urls:
                batch: list[str] = []
                while queue and len(batch) < CONCURRENCY and len(visited) + len(batch) < max_urls:
                    u = queue.popleft()
                    key = _normalize_url(u)
                    if key in visited:
                        continue
                    visited.add(key)
                    batch.append(u)

                if not batch:
                    break

                async def worker(u: str) -> None:
                    nonlocal done
                    async with sem:
                        result, discovered = await _audit_one(client, u, host)
                    audits.append(result)
                    for d in discovered:
                        dk = _normalize_url(d)
                        if dk not in visited and len(visited) + len(queue) < max_urls:
                            queue.append(d)
                    done += 1
                    if done % 25 == 0 or not queue:
                        pct = 5 + int(90 * min(done, max_urls) / max_urls)
                        await ctx.emit_progress(
                            self, pct, f"Crawled {done} URLs ({len(queue)} queued)",
                        )

                await asyncio.gather(*(worker(u) for u in batch))

        scored = [a for a in audits if a.get("fetch_status") == "OK"]
        redirects = [a for a in audits if (a.get("fetch_status") or "").startswith("REDIRECT_")]
        counts = {
            "audited": len(scored),
            "redirects": len(redirects),
            "skipped": len(audits) - len(scored) - len(redirects),
            "total": len(all_urls),
            "crawled": len(audits),
        }
        ctx.set_state("page_audits", audits)
        ctx.set_state("audit_counts", counts)
        await ctx.emit_progress(
            self, 100,
            f"Crawled {counts['crawled']}: {counts['audited']} OK, {counts['redirects']} redirects",
        )
        return {"page_audits": audits, "audit_counts": counts}
