"""
Meta Generator — generuje meta title, meta description i URL slug
na podstawie artykułu i keyword (uproszczona wersja BONSE).
"""
import re
from bs4 import BeautifulSoup


def generate_meta(article_html: str, keyword: str, language: str = "pl") -> dict:
    """
    Wygeneruj SEO meta dane z gotowego artykułu.
    Zwraca: { meta_title, meta_description, meta_url }
    """
    soup = BeautifulSoup(article_html, "lxml")

    # Meta title — z H1 lub keyword
    h1 = soup.find("h1")
    if h1:
        raw_title = h1.get_text(strip=True)
    else:
        raw_title = keyword.capitalize()

    meta_title = _truncate(raw_title, 60)
    if len(meta_title) < 30 and keyword.lower() not in meta_title.lower():
        meta_title = f"{meta_title} | {keyword.capitalize()}"

    # Meta description — pierwszy dłuższy paragraph
    desc = ""
    for p in soup.find_all("p"):
        text = p.get_text(strip=True)
        if len(text) > 80:
            desc = text
            break

    if not desc:
        # Fallback z treści
        all_text = soup.get_text(separator=" ", strip=True)
        desc = all_text[:160]

    meta_description = _truncate(desc, 155)

    # URL slug
    meta_url = _slugify(keyword)

    return {
        "meta_title": meta_title,
        "meta_description": meta_description,
        "meta_url": meta_url,
    }


def _truncate(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    cut = text[:max_len]
    last_space = cut.rfind(" ")
    if last_space > max_len * 0.7:
        return cut[:last_space] + "…"
    return cut + "…"


def _slugify(text: str) -> str:
    """Konwertuj tekst na URL-friendly slug."""
    # Zamień polskie znaki
    replacements = {
        "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n",
        "ó": "o", "ś": "s", "ź": "z", "ż": "z",
        "Ą": "a", "Ć": "c", "Ę": "e", "Ł": "l", "Ń": "n",
        "Ó": "o", "Ś": "s", "Ź": "z", "Ż": "z",
    }
    for pl, en in replacements.items():
        text = text.replace(pl, en)

    slug = text.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug.strip())
    slug = re.sub(r"-+", "-", slug)
    return slug[:100]
