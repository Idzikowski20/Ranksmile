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
        from pipeline.stages.ai_search import AiSearchStage

        return [
            FetchPageStage(),
            ScrapeSerpStage(),
            ClassifyContentStage(),
            ExtractTermsStage(),
            ScoreRankingStage(),
            AiSearchStage(),
        ]
