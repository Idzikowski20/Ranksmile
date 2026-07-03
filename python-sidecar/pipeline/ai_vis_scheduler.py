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

import httpx

SCHEDULER_TICK_HOURS = 6
_tick_lock = asyncio.Lock()


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


async def scheduler_loop(nextjs_url: str) -> None:
    # Startup jitter so synchronized restarts across instances don't all hit
    # due-scans in the same second. Tiny (0–60s) — keeps the first tick effectively
    # immediate for fast post-restart recovery.
    await asyncio.sleep(random.uniform(0, 60))
    while True:
        try:
            await _tick(nextjs_url)
        except Exception as exc:  # noqa: BLE001 — best-effort; keep the loop alive
            print(f"[ai_vis_scheduler] tick failed: {type(exc).__name__}: {exc}")
        await asyncio.sleep(SCHEDULER_TICK_HOURS * 3600)
