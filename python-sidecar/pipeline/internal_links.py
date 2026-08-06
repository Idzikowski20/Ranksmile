"""In-text internal linking: give the Writer an allowlist, then enforce it.

Post-hoc suggestions (``suggest_internal_links``) never reach the article body, so
the Writer gets the domain's published articles as a link allowlist and inserts the
anchors while writing. Anything internal it invents is unwrapped afterwards — an LLM
will happily link /blog/nieistniejacy-artykul otherwise.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

MAX_PROMPT_LINKS = 15
KEEP_SCHEMES = ("mailto:", "tel:", "#")


def _host(value: str) -> str:
    return urlparse(value).netloc.lower().removeprefix("www.")


def _normalize(url: str) -> str:
    """Compare links on host + path only, so ?utm= and trailing slashes don't matter.

    Only the host is case-folded — paths are case-sensitive on most servers, so
    lowercasing here would let an allowed /Guide also authorize the unlisted /guide.
    """
    parsed = urlparse(url.strip())
    path = parsed.path.rstrip("/") or "/"
    return f"{_host(url)}{path}"


def _sanitize_prompt_text(value: object) -> str:
    """Collapse newlines/quotes out of a DB-sourced title or URL before it goes into a
    prompt — this list is per-domain, so any workspace member who can set an article
    title can otherwise break out of the "- \"title\" -> url" line and inject fake
    list entries or instructions into every later article's write prompt."""
    text = str(value or "").strip()
    text = " ".join(text.split())
    return text.replace('"', "'")


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
    quota: str = "2–5",
) -> str:
    """Prompt block listing the only internal URLs the Writer may link to.

    `quota` is the article-level "weave N into the body" instruction. Callers that
    write one paragraph at a time (a compiled write plan calls this once per
    paragraph, not once for the whole article) must pass a per-paragraph quota —
    reusing the article-level "2–5" on every paragraph asks for 2–5 links each,
    compounding into far more anchors than the article was meant to carry.
    """
    entries = [
        (_sanitize_prompt_text(a.get("title")), _sanitize_prompt_text(a.get("url")))
        for a in existing_articles
    ]
    entries = [(title, url) for title, url in entries if title and url][:limit]
    if not entries:
        return ""

    listing = "\n".join(f'- "{title}" → {url}' for title, url in entries)
    if language.startswith("pl"):
        return (
            f"\n\nLINKI WEWNĘTRZNE (wpleć {quota} w treść, tylko z tej listy):\n"
            f"{listing}\n"
            "- Linkuj naturalnie z fragmentu zdania, gdy temat faktycznie się pojawia\n"
            "- Anchor = opisowy tekst, nigdy \"kliknij tutaj\"\n"
            "- NIE wymyślaj innych adresów wewnętrznych — spoza listy nie linkuj"
        )
    return (
        f"\n\nINTERNAL LINKS (weave {quota} into the body, only from this list):\n"
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
    mutated = False

    for anchor in soup.find_all("a"):
        # No downstream HTML sanitizer sees this output — a hallucinated or manipulated
        # Writer response could embed event handlers on an otherwise-legitimate anchor.
        # Stripped regardless of `removed` below: an allowlisted anchor keeps its href
        # but must not keep an onclick either.
        stripped_attrs = [a for a in anchor.attrs if a.lower().startswith("on")]
        for attr in stripped_attrs:
            del anchor[attr]
        mutated = mutated or bool(stripped_attrs)

        href = (anchor.get("href") or "").strip()
        if not href or href.lower().startswith(KEEP_SCHEMES):
            continue
        try:
            parsed = urlparse(href)
        except ValueError:
            # Malformed href (e.g. "https://[invalid") — fail safe, don't 500 the article.
            anchor.unwrap()
            removed += 1
            continue
        is_internal = not parsed.netloc or _host(href) == site_host
        if not is_internal:
            continue
        # Resolve relative hrefs against the real site URL rather than string-pasting a
        # host in front of the path, which mangles anything not already root-relative.
        candidate = href if parsed.netloc else urljoin(site_url, href)
        if _normalize(candidate) in allowed:
            continue
        anchor.unwrap()
        removed += 1

    if not removed and not mutated:
        return html, 0
    return soup.encode(formatter="html").decode("utf-8"), removed
