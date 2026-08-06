"""_scrape_pages reports each page as it settles, so the panel can count 6/10."""
import asyncio

import analyzers.serp_analyzer as serp


class FakeResponse:
    status_code = 200

    def __init__(self, url: str):
        body = " ".join(["slowo"] * 300)
        self.text = f"<html><body><p>{url} {body}</p></body></html>"


async def _fake_get(url, **kwargs):
    return FakeResponse(url)


def test_reports_every_page_with_a_stable_total(monkeypatch):
    monkeypatch.setattr(serp, "ssrf_safe_get", _fake_get)
    seen = []

    async def on_page(finished, total, url):
        seen.append((finished, total, url))

    urls = [f"https://example{i}.pl/a" for i in range(4)]
    asyncio.run(serp._scrape_pages(urls, on_page))

    assert [s[0] for s in seen] == [1, 2, 3, 4]
    assert {s[1] for s in seen} == {4}
    assert sorted(s[2] for s in seen) == sorted(urls)


def test_scrape_survives_a_failing_progress_callback(monkeypatch):
    monkeypatch.setattr(serp, "ssrf_safe_get", _fake_get)

    async def on_page(finished, total, url):
        raise RuntimeError("node is down")

    texts, soups = asyncio.run(serp._scrape_pages(["https://example.pl/a"], on_page))
    assert len(texts) == 1


def test_no_callback_still_scrapes(monkeypatch):
    monkeypatch.setattr(serp, "ssrf_safe_get", _fake_get)
    texts, soups = asyncio.run(serp._scrape_pages(["https://example.pl/a"]))
    assert len(texts) == 1
