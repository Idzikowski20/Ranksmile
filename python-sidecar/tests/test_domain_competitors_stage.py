"""The domain-setup competitors stage only needs the SERP domains. Running the full
analyze_serp per keyword (scrape 20 pages, term extraction, competitor facts) took
~85 s a keyword and blew the 600 s stage timeout at keyword 7/8 on a fresh domain."""
import asyncio

import analyzers.serp_analyzer as serp
from pipeline.contracts import StageContext
from pipeline.stages.domain.competitors import CompetitorsStage


def _serp(keyword: str):
    return [
        {"link": "https://alpha.pl/a", "title": "A", "snippet": ""},
        {"link": "https://beta.pl/b", "title": "B", "snippet": ""},
        {"link": f"https://only-{keyword.replace(' ', '-')}.pl/c", "title": "C", "snippet": ""},
    ]


def test_competitors_come_from_serp_results_without_scraping(monkeypatch):
    monkeypatch.setenv("SERPER_API_KEY", "x")

    async def fake_fetch(keyword, language, num, api_key):
        return _serp(keyword), []

    async def must_not_run(*args, **kwargs):
        raise AssertionError("the competitors stage must not scrape or extract terms")

    monkeypatch.setattr(serp, "_fetch_serp_results", fake_fetch)
    monkeypatch.setattr(serp, "_scrape_pages", must_not_run)
    monkeypatch.setattr(serp, "extract_semantic_terms", must_not_run)

    ctx = StageContext("job", {"language": "pl", "limits": {"competitorsPerKeyword": 10}}, "")
    ctx.set_state("keywords", [{"keyword": "wynajem mieszkania"}, {"keyword": "umowa najmu"}])

    asyncio.run(CompetitorsStage().run(ctx))

    competitors = ctx.get_state("competitors")
    by_domain = {c["competitor_domain"]: c for c in competitors}
    assert by_domain["alpha.pl"]["appearances"] == 2
    assert by_domain["alpha.pl"]["avg_position"] == 1.0
    assert by_domain["beta.pl"]["avg_position"] == 2.0
    assert competitors[0]["competitor_domain"] == "alpha.pl"
