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

# No downstream HTML sanitizer sees this output — enforce_internal_links is the last
# point that parses the LLM-generated body before storage, so it also has to close the
# other stored-XSS vectors, not just on* handlers on <a>: tags that execute on their own
# (script/svg/iframe/...) and javascript:/vbscript: URLs on any element that accepts one.
DANGEROUS_TAGS = ("script", "style", "iframe", "object", "embed", "svg", "form", "base", "meta", "link")
URL_ATTRS = ("href", "src", "action", "formaction")
DANGEROUS_URL_SCHEMES = ("javascript:", "vbscript:", "data:text/html")


def _strip_dangerous_markup(soup: BeautifulSoup) -> bool:
    """Remove self-executing tags and neutralize script-URL attributes. Returns True
    if anything was changed."""
    mutated = False

    for tag in soup.find_all(DANGEROUS_TAGS):
        tag.decompose()
        mutated = True

    for tag in soup.find_all(True):
        on_attrs = [a for a in tag.attrs if a.lower().startswith("on")]
        for attr in on_attrs:
            del tag[attr]
        mutated = mutated or bool(on_attrs)

        for attr in URL_ATTRS:
            value = tag.get(attr)
            if isinstance(value, str):
                # Browsers (and urlparse) strip tabs/newlines/CR before scheme sniffing,
                # so "java&#9;script:" decodes to a literal tab here but would still be
                # recognized as javascript: by the browser — strip the same way first.
                cleaned = value.strip().lower().translate(str.maketrans("", "", "\t\n\r"))
                if cleaned.startswith(DANGEROUS_URL_SCHEMES):
                    del tag[attr]
                    mutated = True

    return mutated


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
    mutated = _strip_dangerous_markup(soup)
    # The Writer sees one paragraph at a time and is handed the same allowlist for each,
    # so it has no way to know a page is already linked. A real article linked the same
    # URL five times; the reference article links nine different pages once each.
    linked: set[str] = set()

    for anchor in soup.find_all("a"):
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
        key = _normalize(candidate)
        if key not in allowed:
            anchor.unwrap()
            removed += 1
            continue
        # First occurrence keeps the link; the repeats keep their text and lose the anchor.
        if key in linked:
            anchor.unwrap()
            removed += 1
            continue
        linked.add(key)

    if not removed and not mutated:
        return html, 0
    # "minimal" escapes only <, > and &. The "html" formatter also turns every accented
    # character into a named entity, so unwrapping one anchor rewrote the surrounding
    # Polish prose as "ofert&eogon;" — and because the untouched path returns `html`
    # verbatim, it only ever corrupted articles that actually had a link removed.
    return soup.decode(formatter="minimal"), removed


def inject_suggestions(html: str, suggestions: list[dict], cap: int = 8) -> tuple[str, int]:
    """Deterministically link suggestion anchors in the article body.

    The writer's per-paragraph quota is a request, not a guarantee — articles kept
    shipping with 2 internal links against the reference's ~10. Suggestions already
    name anchors that appear VERBATIM in the text, so linking them is mechanical:
    first plain-text occurrence, outside existing links and headings, one per target
    URL, capped. Returns (html, inserted_count)."""
    from bs4 import BeautifulSoup, NavigableString

    if not suggestions:
        return html, 0
    soup = BeautifulSoup(html, "html.parser")
    already = {a.get("href", "") for a in soup.find_all("a")}
    inserted = 0
    for sug in suggestions:
        if inserted >= cap:
            break
        anchor = (sug.get("anchorText") or "").strip()
        url = (sug.get("url") or "").strip()
        if not anchor or not url or url in already:
            continue
        target = None
        for node in soup.find_all(string=True):
            if not isinstance(node, NavigableString):
                continue
            parent_names = {p.name for p in node.parents if getattr(p, "name", None)}
            if parent_names & {"a", "h1", "h2", "h3", "h4", "script", "style"}:
                continue
            if anchor.lower() in str(node).lower():
                target = node
                break
        if target is None:
            continue
        text = str(target)
        idx = text.lower().index(anchor.lower())
        link = soup.new_tag("a", href=url)
        link.string = text[idx:idx + len(anchor)]
        target.replace_with(
            NavigableString(text[:idx]), link, NavigableString(text[idx + len(anchor):]),
        )
        already.add(url)
        inserted += 1
    return str(soup), inserted
