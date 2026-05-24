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
