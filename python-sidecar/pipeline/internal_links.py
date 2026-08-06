"""In-text internal linking: give the Writer an allowlist, then enforce it.

Post-hoc suggestions (``suggest_internal_links``) never reach the article body, so
the Writer gets the domain's published articles as a link allowlist and inserts the
anchors while writing. Anything internal it invents is unwrapped afterwards — an LLM
will happily link /blog/nieistniejacy-artykul otherwise.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from urllib.parse import urlparse

from bs4 import BeautifulSoup

MAX_PROMPT_LINKS = 15
KEEP_SCHEMES = ("mailto:", "tel:", "#")


def _host(value: str) -> str:
    return urlparse(value).netloc.lower().removeprefix("www.")


def _normalize(url: str) -> str:
    """Compare links on host + path only, so ?utm= and trailing slashes don't matter."""
    parsed = urlparse(url.strip())
    path = parsed.path.rstrip("/") or "/"
    return f"{_host(url)}{path}".lower()


def allowed_link_urls(existing_articles: Iterable[Mapping[str, object]]) -> set[str]:
    urls = set()
    for article in existing_articles:
        url = article.get("url")
        if isinstance(url, str) and url.strip():
            urls.add(_normalize(url))
    return urls


def format_internal_link_block(
    existing_articles: list[Mapping[str, object]],
    language: str = "pl",
    limit: int = MAX_PROMPT_LINKS,
) -> str:
    """Prompt block listing the only internal URLs the Writer may link to."""
    entries = [
        (str(a.get("title") or "").strip(), str(a.get("url") or "").strip())
        for a in existing_articles
    ]
    entries = [(title, url) for title, url in entries if title and url][:limit]
    if not entries:
        return ""

    listing = "\n".join(f'- "{title}" → {url}' for title, url in entries)
    if language.startswith("pl"):
        return (
            "\n\nLINKI WEWNĘTRZNE (wpleć 2–5 w treść, tylko z tej listy):\n"
            f"{listing}\n"
            "- Linkuj naturalnie z fragmentu zdania, gdy temat faktycznie się pojawia\n"
            "- Anchor = opisowy tekst, nigdy \"kliknij tutaj\"\n"
            "- NIE wymyślaj innych adresów wewnętrznych — spoza listy nie linkuj"
        )
    return (
        "\n\nINTERNAL LINKS (weave 2–5 into the body, only from this list):\n"
        f"{listing}\n"
        "- Link naturally from mid-sentence text where the topic genuinely comes up\n"
        '- Anchor = descriptive text, never "click here"\n'
        "- Do NOT invent any other internal URL — link nothing outside this list"
    )


def enforce_internal_links(html: str, allowed: set[str], site_url: str) -> tuple[str, int]:
    """Unwrap internal anchors that aren't on the allowlist. External links stay.

    Returns (html, removed_count).
    """
    if not html.strip():
        return html, 0

    site_host = _host(site_url)
    soup = BeautifulSoup(html, "html.parser")
    removed = 0

    for anchor in soup.find_all("a"):
        href = (anchor.get("href") or "").strip()
        if not href or href.startswith(KEEP_SCHEMES):
            continue
        parsed = urlparse(href)
        is_internal = not parsed.netloc or _host(href) == site_host
        if not is_internal:
            continue
        candidate = href if parsed.netloc else f"https://{site_host}{parsed.path}"
        if _normalize(candidate) in allowed:
            continue
        anchor.unwrap()
        removed += 1

    return (str(soup), removed) if removed else (html, 0)
