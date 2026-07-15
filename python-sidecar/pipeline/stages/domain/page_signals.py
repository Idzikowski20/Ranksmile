"""Extract on-page signals from blog-post HTML for triage scoring (P3d)."""
import hashlib
import re
from urllib.parse import urljoin, urlparse

from analyzers.html_parse import parse_html

CONTENT_SELECTORS = [
    "article", "main", ".post-content", ".entry-content",
    ".article-content", "#content", '[role="main"]',
]

_SKIP_HREF_PREFIXES = ("#", "mailto:", "tel:", "javascript:", "data:")
_LONG_PARAGRAPH_WORDS = 150


def _main_node(soup):
    for sel in CONTENT_SELECTORS:
        node = soup.select_one(sel)
        if node and len(node.get_text(separator=" ", strip=True).split()) >= 50:
            return node
    return soup.body or soup


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _is_malformed_href(href: str) -> bool:
    raw = (href or "").strip()
    if not raw:
        return False
    lower = raw.lower()
    if any(lower.startswith(p) for p in _SKIP_HREF_PREFIXES):
        return False
    if " " in raw:
        return True
    if re.search(r"[^\x00-\x7F]", raw) and "://" in raw:
        return True
    try:
        parsed = urlparse(raw)
    except ValueError:
        return True
    if raw.startswith(("http://", "https://")):
        return not bool(parsed.netloc)
    if raw.startswith("//"):
        return not bool(parsed.netloc)
    if raw.startswith("/"):
        return False
    if ":" in raw and not parsed.scheme:
        return True
    return False


def _is_internal_href(href: str, page_url: str, host: str) -> bool:
    if href.startswith("/"):
        return True
    if host and host in href:
        return True
    try:
        parsed = urlparse(urljoin(page_url, href))
        return bool(host) and parsed.netloc == host
    except ValueError:
        return False


def _resolve_href(href: str, page_url: str) -> str:
    try:
        return urljoin(page_url, href).split("#")[0].split("?")[0]
    except ValueError:
        return href


def _has_nofollow(rel: str | None) -> bool:
    if not rel:
        return False
    return "nofollow" in rel.lower().split()


def _anchor_text(a) -> str:
    return a.get_text(separator=" ", strip=True)


def _is_no_anchor(href: str, anchor: str) -> bool:
    if not anchor:
        return True
    if anchor == href or anchor == href.rstrip("/"):
        return True
    # Symbols only (no letters or digits)
    if not re.search(r"[\w\u0080-\uffff]", anchor, re.UNICODE):
        return True
    return False


def _heading_hierarchy_issues(soup) -> bool:
    """True if heading levels skip (e.g. h1 -> h3)."""
    levels: list[int] = []
    for tag in soup.find_all(re.compile(r"^h[1-6]$", re.I)):
        try:
            level = int(tag.name[1])
        except (TypeError, ValueError, IndexError):
            continue
        levels.append(level)
    if len(levels) < 2:
        return False
    for i in range(1, len(levels)):
        if levels[i] > levels[i - 1] + 1:
            return True
    return False


def extract_page_signals(html: str, url: str) -> dict:
    soup = parse_html(html)

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""
    desc_tag = soup.find("meta", attrs={"name": "description"})
    description = desc_tag.get("content", "") if desc_tag else ""

    node = _main_node(soup)
    text = node.get_text(separator=" ", strip=True)
    word_count = len([w for w in text.split() if w])

    headings = node.find_all(["h1", "h2", "h3"])
    paragraphs = [p for p in node.find_all("p") if p.get_text(strip=True)]
    long_paragraphs = sum(
        1 for p in paragraphs
        if len(p.get_text(separator=" ", strip=True).split()) > _LONG_PARAGRAPH_WORDS
    )

    h1_tags = soup.find_all("h1")
    h1_texts = [h.get_text(strip=True) for h in h1_tags if h.get_text(strip=True)]
    h1_text = h1_texts[0] if h1_texts else ""
    duplicate_h1_title = bool(
        h1_text and title and _normalize_text(h1_text) == _normalize_text(title)
    )

    imgs = node.find_all("img")
    with_alt = sum(1 for i in imgs if (i.get("alt") or "").strip())
    image_alt_ratio = (with_alt / len(imgs)) if imgs else 1.0

    parsed_url = urlparse(url)
    host = parsed_url.netloc

    content_hash = hashlib.sha256(text.encode("utf-8", "ignore")).hexdigest()

    body_node = soup.body or soup
    body_text = body_node.get_text(separator=" ", strip=True)
    html_bytes = len(html.encode("utf-8", "ignore"))
    text_bytes = len(body_text.encode("utf-8", "ignore"))
    text_html_ratio = round(text_bytes / html_bytes, 3) if html_bytes else 0.0

    malformed_links: list[dict[str, str]] = []
    external_nofollow_links: list[dict[str, str]] = []
    no_anchor_links: list[dict[str, str]] = []
    external_links: list[dict[str, str]] = []
    outbound_internal_hrefs: list[str] = []
    internal_seen: set[str] = set()
    link_count = 0
    internal_links = 0

    for a in body_node.find_all("a", href=True):
        href = (a.get("href") or "").strip()
        if not href or any(href.lower().startswith(p) for p in _SKIP_HREF_PREFIXES):
            continue
        link_count += 1
        anchor = _anchor_text(a)
        rel = a.get("rel")

        if _is_malformed_href(href):
            malformed_links.append({"href": href[:500], "anchor": anchor[:200]})

        if _is_no_anchor(href, anchor):
            no_anchor_links.append({"href": href[:500], "anchor": anchor[:200]})

        is_internal = _is_internal_href(href, url, host)
        if is_internal:
            internal_links += 1
            resolved = _resolve_href(href, url)
            if resolved not in internal_seen:
                internal_seen.add(resolved)
                outbound_internal_hrefs.append(resolved)
        else:
            external_links.append({"href": href[:500]})
            if _has_nofollow(rel):
                external_nofollow_links.append({"href": href[:500], "anchor": anchor[:200]})

    return {
        "url": url,
        "path": parsed_url.path or "/",
        "title": title,
        "word_count": word_count,
        "title_length": len(title),
        "description_length": len(description),
        "heading_count": len(headings),
        "paragraph_count": len(paragraphs),
        "image_alt_ratio": round(image_alt_ratio, 3),
        "internal_links": internal_links,
        "text_html_ratio": text_html_ratio,
        "link_count": link_count,
        "malformed_links": malformed_links,
        "content_hash": content_hash,
        "body_text": text[:12000],
        "h1_count": len(h1_tags),
        "h1_text": h1_text,
        "h1_texts": h1_texts[:5],
        "duplicate_h1_title": duplicate_h1_title,
        "outbound_internal_hrefs": outbound_internal_hrefs,
        "external_nofollow_links": external_nofollow_links,
        "no_anchor_links": no_anchor_links,
        "external_links": external_links,
        "heading_hierarchy_issues": _heading_hierarchy_issues(soup),
        "long_paragraphs": long_paragraphs,
    }
