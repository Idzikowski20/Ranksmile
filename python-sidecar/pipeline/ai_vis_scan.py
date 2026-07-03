"""Durable driver for an AI Visibility scan.

The scan's actual work (DataForSEO calls per prompt × model, DB writes, scoring)
lives in TypeScript — the single source of truth. This module only *drives* it:
it repeatedly calls Node's /api/ai-visibility/internal/run-chunk until the scan
reports `finished`. Because it runs as a detached asyncio task on the always-on
sidecar, it survives the triggering HTTP request AND any single serverless time
limit on the Node side. Chunks are idempotent (Node derives "done" from rows
already written), so re-driving after a transient failure never double-charges.
"""
import asyncio
import os

import httpx

MAX_CONSECUTIVE_ERRORS = 5
MAX_CHUNKS = 2000  # backstop only; a full 250-pair scan is ~13 chunks of 20


async def run_scan_loop(scan_id: int, nextjs_url: str) -> None:
    url = f"{nextjs_url.rstrip('/')}/api/ai-visibility/internal/run-chunk"
    headers = {
        "Content-Type": "application/json",
        "x-internal-token": os.environ.get("INTERNAL_PIPELINE_TOKEN", ""),
    }
    errors = 0
    try:
        # Client timeout > Node maxDuration (300s) so we wait out a full chunk.
        async with httpx.AsyncClient(timeout=310) as client:
            for _ in range(MAX_CHUNKS):
                try:
                    resp = await client.post(url, headers=headers, json={"scanId": scan_id})
                    if resp.status_code >= 400:
                        errors += 1
                        print(f"[ai_vis_scan] scan {scan_id} chunk HTTP {resp.status_code}: {resp.text[:200]} ({errors}/{MAX_CONSECUTIVE_ERRORS})")
                        if errors >= MAX_CONSECUTIVE_ERRORS:
                            print(f"[ai_vis_scan] giving up scan {scan_id} after {errors} errors")
                            return
                        await asyncio.sleep(min(30, 2 ** errors))
                        continue

                    errors = 0
                    data = resp.json()
                    if data.get("finished"):
                        print(f"[ai_vis_scan] scan {scan_id} finished: {data.get('done')}/{data.get('total')}")
                        return
                    # Small yield; the chunk itself already spent ~30s doing real work.
                    await asyncio.sleep(0.5)
                except Exception as exc:  # noqa: BLE001 — best-effort loop, never propagate
                    errors += 1
                    print(f"[ai_vis_scan] scan {scan_id} chunk error: {type(exc).__name__}: {exc} ({errors}/{MAX_CONSECUTIVE_ERRORS})")
                    if errors >= MAX_CONSECUTIVE_ERRORS:
                        print(f"[ai_vis_scan] giving up scan {scan_id}")
                        return
                    await asyncio.sleep(min(30, 2 ** errors))
        print(f"[ai_vis_scan] scan {scan_id} hit MAX_CHUNKS guard")
    except Exception as exc:  # noqa: BLE001
        print(f"[ai_vis_scan] scan {scan_id} loop crashed: {type(exc).__name__}: {exc}")
