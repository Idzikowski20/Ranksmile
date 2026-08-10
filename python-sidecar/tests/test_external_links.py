"""A model-proposed authority link is a guess until something follows it."""
import asyncio

import pytest

from pipeline import external_links
from pipeline.external_links import is_authority_url, verify_external_links


SITE = "https://prodetektyw.pl"


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    """Default: every authority-shaped URL resolves. Tests that care override it."""
    async def _ok(_url: str) -> bool:
        return True
    monkeypatch.setattr(external_links, "_resolves", _ok)


def run(html: str, site: str = SITE):
    return asyncio.run(verify_external_links(html, site))


def test_authority_host_is_matched_on_the_hostname_not_the_raw_url():
    assert is_authority_url("https://isap.sejm.gov.pl/eli/DU/2001/1159")
    # Both smuggle an allowlisted string into a hostile host.
    assert not is_authority_url("https://evil.com/isap.sejm.gov.pl")
    assert not is_authority_url("https://evil.com?x=.gov.pl")
    # A link we would put in front of a reader is one we would send them to.
    assert not is_authority_url("http://sejm.gov.pl/act")


def test_keeps_a_reachable_authority_link():
    html = '<p>Zgodnie z <a href="https://isap.sejm.gov.pl/eli/DU/2001/1159">ustawą</a>.</p>'
    out, removed = run(html)
    assert removed == 0
    assert "isap.sejm.gov.pl" in out


def test_unwraps_a_commercial_link_but_keeps_its_text():
    html = '<p>Zobacz <a href="https://konkurencja.pl/oferta">ofertę</a> firmy.</p>'
    out, removed = run(html)
    assert removed == 1
    assert "<a" not in out
    assert "ofertę" in out, "the sentence must survive losing its link"


def test_unwraps_an_authority_url_that_does_not_resolve(monkeypatch):
    async def _dead(_url: str) -> bool:
        return False
    monkeypatch.setattr(external_links, "_resolves", _dead)

    html = '<p>Zgodnie z <a href="https://isap.sejm.gov.pl/eli/DU/9999/0001">ustawą</a>.</p>'
    out, removed = run(html)
    assert removed == 1
    assert "<a" not in out


def test_leaves_internal_and_scheme_links_alone():
    html = (
        '<p><a href="https://prodetektyw.pl/uslugi">usługi</a> '
        '<a href="/kontakt">kontakt</a> '
        '<a href="mailto:biuro@prodetektyw.pl">mail</a></p>'
    )
    out, removed = run(html)
    assert removed == 0
    assert out.count("<a") == 3


def test_caps_the_number_of_authority_links():
    links = "".join(
        f'<p>Fakt <a href="https://isap.sejm.gov.pl/eli/DU/2001/{i}">źródło</a>.</p>'
        for i in range(6)
    )
    out, removed = run(links)
    assert out.count("<a") == external_links.MAX_EXTERNAL_LINKS
    assert removed == 6 - external_links.MAX_EXTERNAL_LINKS


def test_empty_html_is_untouched():
    assert run("") == ("", 0)
