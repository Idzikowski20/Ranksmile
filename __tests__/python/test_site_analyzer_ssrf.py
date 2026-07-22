"""Regression tests for SSRF protection in site_analyzer."""
import asyncio
import os
import sys


SIDECAR_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "python-sidecar"))
if SIDECAR_ROOT not in sys.path:
    sys.path.insert(0, SIDECAR_ROOT)

from analyzers import site_analyzer


def test_analyze_site_blocks_private_ip_before_fetch(monkeypatch):
    def fail_client(*_args, **_kwargs):
        raise AssertionError("private URLs must not open an HTTP client")

    monkeypatch.setattr(site_analyzer.httpx, "AsyncClient", fail_client)

    result = asyncio.run(site_analyzer.analyze_site("http://127.0.0.1/internal"))

    assert result["score"] == 0
    assert result["final_url"] == "http://127.0.0.1/internal"


def test_analyze_site_blocks_redirect_to_private_ip(monkeypatch):
    requested_urls = []

    class FakeResponse:
        status_code = 302
        headers = {"location": "http://169.254.169.254/latest/meta-data/"}
        text = ""
        url = "https://example.com"

        def raise_for_status(self):
            return None

    class FakeClient:
        def __init__(self, *_args, **_kwargs):
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url, headers=None):
            requested_urls.append(url)
            return FakeResponse()

    monkeypatch.setattr(site_analyzer.httpx, "AsyncClient", FakeClient)

    result = asyncio.run(site_analyzer.analyze_site("https://example.com"))

    assert requested_urls == ["https://example.com"]
    assert result["score"] == 0
    assert result["final_url"] == "https://example.com"
