"""emit_phase posts a typed patch; it must never raise into the pipeline."""
import asyncio

from pipeline.contracts import StageContext


def test_emit_phase_without_nextjs_url_is_a_noop():
    ctx = StageContext("job_1", {}, "")
    asyncio.run(ctx.emit_phase({"crawlingSerp": {"status": "RUNNING", "finished": 1, "total": 10}}))


def test_emit_phase_builds_the_expected_body(monkeypatch):
    sent = {}

    class FakeResponse:
        status_code = 200
        text = ""

    class FakeClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, headers=None, json=None):
            sent["url"] = url
            sent["json"] = json
            return FakeResponse()

    import pipeline.contracts as contracts
    monkeypatch.setattr(contracts.httpx, "AsyncClient", FakeClient)

    ctx = StageContext("job_2", {}, "http://localhost:3000")
    patch = {"crawlingSerp": {"status": "RUNNING", "finished": 6, "total": 10,
                              "currentUrl": "https://pl.wikipedia.org/x"}}
    asyncio.run(ctx.emit_phase(patch, "Crawling result 6/10"))

    assert sent["url"].endswith("/api/articles/job-progress")
    assert sent["json"]["jobId"] == "job_2"
    assert sent["json"]["phases"] == patch
    assert sent["json"]["message"] == "Crawling result 6/10"


def test_emit_phase_swallows_transport_errors(monkeypatch):
    class ExplodingClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            raise RuntimeError("connection refused")

        async def __aexit__(self, *a):
            return False

    import pipeline.contracts as contracts
    monkeypatch.setattr(contracts.httpx, "AsyncClient", ExplodingClient)

    ctx = StageContext("job_3", {}, "http://localhost:3000")
    asyncio.run(ctx.emit_phase({"aiSearch": {"status": "RUNNING"}}))
