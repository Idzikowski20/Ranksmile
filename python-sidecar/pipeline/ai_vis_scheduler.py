"""Cadence driver for AI Visibility.

Every SCHEDULER_TICK_HOURS the sidecar asks Node which configs are due for a
14-day refresh (Node applies the predicate + cap), then drives each returned scan
through the existing run_scan_loop. An asyncio.Lock ensures a tick never overlaps
itself (e.g. after a restart). Best-effort — never raises out of the loop.

SCHEDULER_TICK_HOURS mirrors AI_VIS_SETTINGS.SCHEDULER_TICK_HOURS in lib/aiVisibility.ts.
"""
import asyncio
import os
import random
import time

import httpx

SCHEDULER_TICK_HOURS = 6
CONNECT_RETRY_SEC = 30
CONNECT_RETRY_MAX_WAIT_SEC = 180
_tick_lock = asyncio.Lock()


async def _wait_for_nextjs(nextjs_url: str) -> None:
    """Block until Next.js accepts HTTP (mprocs starts sidecar before Next compiles)."""
    base = nextjs_url.rstrip("/")
    deadline = time.monotonic() + CONNECT_RETRY_MAX_WAIT_SEC
    attempt = 0
    while time.monotonic() < deadline:
        attempt += 1
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{base}/")
            if resp.status_code < 500:
                if attempt > 1:
                    print(f"[ai_vis_scheduler] Next.js ready at {nextjs_url}")
                return
        except httpx.ConnectError:
            pass
        except httpx.HTTPError:
            pass
        wait = min(CONNECT_RETRY_SEC, max(0, deadline - time.monotonic()))
        if wait <= 0:
            break
        if attempt == 1:
            print(f"[ai_vis_scheduler] waiting for Next.js at {nextjs_url}…")
        await asyncio.sleep(wait)
    print(
        f"[ai_vis_scheduler] Next.js still unreachable at {nextjs_url} "
        f"after {CONNECT_RETRY_MAX_WAIT_SEC}s — will retry every {CONNECT_RETRY_SEC}s"
    )


async def _tick(nextjs_url: str) -> None:
    async with _tick_lock:
        url = f"{nextjs_url.rstrip('/')}/api/ai-visibility/internal/due-scans"
        headers = {
            "Content-Type": "application/json",
            "x-internal-token": os.environ.get("INTERNAL_PIPELINE_TOKEN", ""),
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, headers=headers, json={})
        if resp.status_code >= 400:
            print(f"[ai_vis_scheduler] due-scans HTTP {resp.status_code}: {resp.text[:200]}")
            return
        due = resp.json().get("due", [])
        # Import here to avoid a circular import at module load.
        from pipeline.ai_vis_scan import run_scan_loop
        # SEQUENTIAL, not create_task: a batch of 5 scans launched at once would fan
        # out to ~5×250 concurrent DataForSEO calls (rate-limit / memory risk). The
        # 6h tick has slack — whether the batch finishes in 20 or 50 min is fine.
        for item in due:
            await run_scan_loop(item["scanId"], nextjs_url)
        print(f"[ai_vis_scheduler] tick processed {len(due)} scan(s)")

        # Backfill brand extraction for scans that still have un-analysed answers
        # (best-effort; Sources just shows "no brands yet" until this drains).
        try:
            brand_url = f"{nextjs_url.rstrip('/')}/api/ai-visibility/internal/analyze-brands"
            async with httpx.AsyncClient(timeout=60) as client:
                await client.post(brand_url, headers=headers, json={})
        except Exception as exc:  # noqa: BLE001 - never let backfill break the tick
            print(f"[ai_vis_scheduler] analyze-brands failed: {exc}")


async def scheduler_loop(nextjs_url: str) -> None:
    # Startup jitter so synchronized restarts across instances don't all hit
    # due-scans in the same second. Tiny (0–60s) — keeps the first tick effectively
    # immediate for fast post-restart recovery.
    await asyncio.sleep(random.uniform(0, 60))
    await _wait_for_nextjs(nextjs_url)
    while True:
        sleep_sec = SCHEDULER_TICK_HOURS * 3600
        try:
            await _tick(nextjs_url)
        except httpx.ConnectError as exc:
            print(f"[ai_vis_scheduler] tick failed: Next.js unreachable at {nextjs_url}: {exc}")
            sleep_sec = CONNECT_RETRY_SEC
        except Exception as exc:  # noqa: BLE001 — best-effort; keep the loop alive
            print(f"[ai_vis_scheduler] tick failed: {type(exc).__name__}: {exc}")
        await asyncio.sleep(sleep_sec)
