"""Extract on-page signals from blog-post HTML for triage scoring (P3d)."""
import hashlib
from urllib.parse import urlparse

from bs4 import BeautifulSoup

CONTENT_SELECTORS = [
    "article", "main", ".post-content", ".entry-content",
    ".article-content", "#content", '[role="main"]',
]


def _main_node(soup: BeautifulSoup):
    for sel in CONTENT_SELECTORS:
        node = soup.select_one(sel)
        if node and len(node.get_text(separator=" ", strip=True).split()) >= 50:
            return node
    return soup.body or soup


def extract_page_signals(html: str, url: str) -> dict:
    soup = BeautifulSoup(html or "", "lxml")

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""
    desc_tag = soup.find("meta", attrs={"name": "description"})
    description = desc_tag.get("content", "") if desc_tag else ""

    node = _main_node(soup)
    text = node.get_text(separator=" ", strip=True)
    word_count = len([w for w in text.split() if w])

    headings = node.find_all(["h1", "h2", "h3"])
    paragraphs = [p for p in node.find_all("p") if p.get_text(strip=True)]

    imgs = node.find_all("img")
    with_alt = sum(1 for i in imgs if (i.get("alt") or "").strip())
    image_alt_ratio = (with_alt / len(imgs)) if imgs else 1.0

    host = urlparse(url).netloc
    internal_links = 0
    for a in node.find_all("a", href=True):
        href = a["href"]
        if href.startswith("/") or host and host in href:
            internal_links += 1

    content_hash = hashlib.sha256(text.encode("utf-8", "ignore")).hexdigest()

    return {
        "url": url,
        "path": urlparse(url).path or "/",
        "title": title,
        "word_count": word_count,
        "title_length": len(title),
        "description_length": len(description),
        "heading_count": len(headings),
        "paragraph_count": len(paragraphs),
        "image_alt_ratio": round(image_alt_ratio, 3),
        "internal_links": internal_links,
        "content_hash": content_hash,
    }
