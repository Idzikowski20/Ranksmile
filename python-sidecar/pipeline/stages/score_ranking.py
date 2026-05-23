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
