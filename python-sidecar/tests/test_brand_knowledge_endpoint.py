"""The Brand Knowledge draft is only as good as the page text it is handed.

analyze_site returns the scraped body under content.text_sample; the endpoint used to
read content["text"], a key nothing produces, so every draft was written from the title
and meta description alone — and the setup wizard stored a thin (or empty) result.
"""
import os

os.environ.setdefault("INTERNAL_PIPELINE_TOKEN", "test-token")
os.environ.setdefault("OPENROUTER_API_KEY", "test-key")

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

HEADERS = {"x-internal-token": os.environ["INTERNAL_PIPELINE_TOKEN"]}
BODY_TEXT = "Projektujemy sklepy internetowe i prowadzimy pozycjonowanie dla firm z Warszawy."


def _site(text: str) -> dict:
    return {
        "meta": {"title": "Agencja", "description": "Strony i SEO"},
        "content": {"word_count": 12, "text_sample": text},
    }


def test_the_scraped_body_reaches_the_drafter(monkeypatch):
    seen: dict = {}

    async def fake_analyze_site(url):
        return _site(BODY_TEXT)

    async def fake_generate(url, title, description, page_text):
        seen.update(url=url, title=title, description=description, page_text=page_text)
        return {"brand_name": "Agencja", "brand_knowledge": "Business Type\nAgencja"}

    monkeypatch.setattr(main, "analyze_site", fake_analyze_site)
    monkeypatch.setattr(main, "generate_brand_knowledge", fake_generate)

    resp = TestClient(main.app).post("/brand-knowledge", json={"url": "https://example.pl"}, headers=HEADERS)

    assert resp.status_code == 200
    assert seen["page_text"] == BODY_TEXT
    assert seen["title"] == "Agencja"


def test_an_unreadable_site_is_reported_not_drafted_from_nothing(monkeypatch):
    async def fake_analyze_site(url):
        # What analyze_site returns when the fetch failed (_empty_context).
        return {"meta": {}, "title": "", "content": {"word_count": 0, "text_sample": ""}}

    async def must_not_draft(*args, **kwargs):
        raise AssertionError("nothing was scraped — there is nothing to draft from")

    monkeypatch.setattr(main, "analyze_site", fake_analyze_site)
    monkeypatch.setattr(main, "generate_brand_knowledge", must_not_draft)

    resp = TestClient(main.app).post("/brand-knowledge", json={"url": "https://example.pl"}, headers=HEADERS)

    assert resp.status_code == 422
    assert "read" in resp.json()["detail"].lower()


def test_a_failed_draft_is_an_error_not_an_empty_success(monkeypatch):
    async def fake_analyze_site(url):
        return _site(BODY_TEXT)

    async def empty_draft(url, title, description, page_text):
        # _chat swallows OpenRouter failures and returns "" — the draft comes back blank.
        return {"brand_name": "", "brand_knowledge": ""}

    monkeypatch.setattr(main, "analyze_site", fake_analyze_site)
    monkeypatch.setattr(main, "generate_brand_knowledge", empty_draft)

    resp = TestClient(main.app).post("/brand-knowledge", json={"url": "https://example.pl"}, headers=HEADERS)

    assert resp.status_code == 502
