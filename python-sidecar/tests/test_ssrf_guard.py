"""SSRF guard: redirect hops must be re-validated (no follow_redirects blind)."""
from __future__ import annotations

import asyncio
from urllib.parse import urlparse

import httpx
import pytest

from pipeline.ssrf_guard import assert_public_url, ssrf_safe_get


def test_assert_public_url_blocks_loopback():
    with pytest.raises(ValueError, match="Blocked"):
        assert_public_url("http://127.0.0.1/secret")


def test_assert_public_url_blocks_metadata_ip():
    with pytest.raises(ValueError, match="Blocked"):
        assert_public_url("http://169.254.169.254/latest/meta-data/")


def test_ssrf_safe_get_blocks_redirect_to_private(monkeypatch):
    """Blind follow_redirects=True would fetch 127.0.0.1; hop re-check must raise."""

    def fake_assert(raw_url: str) -> None:
        host = (urlparse(raw_url).hostname or "").lower()
        if host in {"127.0.0.1", "localhost"} or host.startswith("169.254."):
            raise ValueError("Blocked private address")
        if host not in {"safe.example", "example.com"}:
            raise ValueError(f"unexpected host in test: {host}")

    monkeypatch.setattr("pipeline.ssrf_guard.assert_public_url", fake_assert)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "safe.example":
            return httpx.Response(302, headers={"Location": "http://127.0.0.1/admin"})
        return httpx.Response(200, text="should-not-reach")

    async def run() -> None:
        with pytest.raises(ValueError, match="Blocked"):
            await ssrf_safe_get(
                "https://safe.example/page",
                transport=httpx.MockTransport(handler),
            )

    asyncio.run(run())


def test_ssrf_safe_get_follows_safe_redirect(monkeypatch):
    def fake_assert(raw_url: str) -> None:
        if urlparse(raw_url).hostname != "example.com":
            raise ValueError("Blocked host")

    monkeypatch.setattr("pipeline.ssrf_guard.assert_public_url", fake_assert)

    hops: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        hops.append(request.url.path)
        if request.url.path == "/a":
            return httpx.Response(302, headers={"Location": "/b"})
        return httpx.Response(200, text="ok-body")

    async def run() -> httpx.Response:
        return await ssrf_safe_get(
            "https://example.com/a",
            transport=httpx.MockTransport(handler),
        )

    resp = asyncio.run(run())
    assert resp.status_code == 200
    assert resp.text == "ok-body"
    assert hops == ["/a", "/b"]
