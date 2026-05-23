"""
Site Analyzer — kompleksowy audyt SEO strony.
Scrape'uje URL i zwraca pełny raport techniczny:
- Meta tags (title, description, OG, canonical, robots, hreflang)
- Headings structure (hierarchy validation)
- Content stats (words, paragraphs, lists, links, images)
- Schema.org structured data detection
- Image alt text audit
- Issues list with severity and recommendations
"""
import os
import re
import json
from urllib.parse import urljoin, urlparse
from typing import Optional
import httpx
from bs4 import BeautifulSoup


NEXTJS_URL = os.getenv("NEXTJS_URL", "http://127.0.0.1:3000")


async def _fetch_via_spa_fallback(url: str, html: str) -> str | None:
    """If HTML looks like a SPA shell (< 300 visible words), retry via headless browser."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    if len(text.split()) >= 300:
        return None  # Content is fine

    try:
        async with httpx.AsyncClient(timeout=25) as client:
            resp = await client.post(
                f"{NEXTJS_URL}/api/render-page",
                json={"url": url, "timeout": 15000},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("html"):
                print(f"[site_analyzer] SPA fallback success for {url} ({len(html)} → {len(data['html'])} chars)")
                return data["html"]
    except Exception as exc:
        print(f"[site_analyzer] SPA fallback failed for {url}: {exc}")

    return None


async def analyze_site(url: str) -> dict:
    """
    Pobierz URL i wykonaj pełny audyt SEO.
    Zwraca szczegółowy raport techniczny.
    """
    if not url.startswith("http"):
        url = f"https://{url}"

    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            response = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; SerpBearBot/1.0)"
            })
            response.raise_for_status()
            html = response.text
            final_url = str(response.url)

            # SPA fallback: if content looks thin, retry with headless browser
            rendered = await _fetch_via_spa_fallback(url, html)
            if rendered:
                html = rendered
    except Exception as e:
        print(f"[site_analyzer] Failed to fetch {url}: {e}")
        return _empty_context(url)

    soup = BeautifulSoup(html, "lxml")
    issues: list[dict] = []

    # ── Meta Tags ──────────────────────────────────────────────────
    meta = _analyze_meta(soup, url, issues)

    # ── Headings Structure ─────────────────────────────────────────
    headings = _analyze_headings(soup, issues)

    # ── Content Stats ──────────────────────────────────────────────
    content = _analyze_content(soup, html, final_url, issues)

    # ── Images ─────────────────────────────────────────────────────
    images = _analyze_images(soup, issues)

    # ── Schema / Structured Data ───────────────────────────────────
    schema = _analyze_schema(soup, issues)

    # ── Language ───────────────────────────────────────────────────
    language = soup.html.get("lang", "") if soup.html else ""
    language = language.split("-")[0][:2] if language else _detect_language_heuristic(content.get("text_sample", ""))

    # ── Tone ───────────────────────────────────────────────────────
    tone = _detect_tone(content.get("text_sample", ""))

    # ── Tech Stack Hints ───────────────────────────────────────────
    tech = _detect_tech(html, url)

    # ── Build Context (backward-compat + new fields) ────────────────
    context = {
        "url": url,
        "final_url": final_url,
        # Backward-compat fields
        "title": meta.get("title", ""),
        "description": meta.get("description", ""),
        "tone": tone,
        "language": language,
        "topics": [h["text"] for h in headings.get("list", []) if h["level"] == "h2"][:10],
        "h_tags": headings.get("list", [])[:20],
        "text_sample": content.get("text_sample", ""),
        # New audit fields
        "meta": meta,
        "headings": headings,
        "content": content,
        "images": images,
        "schema": schema,
        "tech": tech,
        "issues": issues,
        "issue_count": len(issues),
        "issue_count_error": sum(1 for i in issues if i["severity"] == "error"),
        "issue_count_warning": sum(1 for i in issues if i["severity"] == "warning"),
        "score": _compute_audit_score(issues),
    }

    return context


# ── Sub-analyzers ───────────────────────────────────────────────────────

def _analyze_meta(soup: BeautifulSoup, url: str, issues: list[dict]) -> dict:
    """Wyciąga i ocenia meta tagi strony."""
    result: dict = {
        "title": "",
        "title_length": 0,
        "title_ok": False,
        "description": "",
        "description_length": 0,
        "description_ok": False,
        "canonical": "",
        "robots": "",
        "hreflang": [],
        "viewport": "",
        "og_title": "",
        "og_description": "",
        "og_image": "",
        "og_type": "",
        "twitter_card": "",
    }

    # Title
    title_tag = soup.find("title")
    if title_tag:
        result["title"] = title_tag.get_text(strip=True)
        result["title_length"] = len(result["title"])
        if 30 <= result["title_length"] <= 65:
            result["title_ok"] = True
        elif result["title_length"] < 30:
            issues.append({"severity": "warning", "check": "Meta Title", "message": f"Title too short ({result['title_length']} chars). Should be 30-65 chars.", "recommendation": "Expand the title to include the primary keyword and be more descriptive."})
        else:
            issues.append({"severity": "warning", "check": "Meta Title", "message": f"Title too long ({result['title_length']} chars). Should be 30-65 chars.", "recommendation": "Trim the title to fit within 65 characters for optimal SERP display."})
    else:
        issues.append({"severity": "error", "check": "Meta Title", "message": "Missing <title> tag.", "recommendation": "Add a title tag with the primary keyword."})

    # Description
    desc_tag = soup.find("meta", attrs={"name": "description"})
    if desc_tag:
        result["description"] = desc_tag.get("content", "")
        result["description_length"] = len(result["description"])
        if 70 <= result["description_length"] <= 160:
            result["description_ok"] = True
        elif result["description_length"] < 70:
            issues.append({"severity": "warning", "check": "Meta Description", "message": f"Description too short ({result['description_length']} chars). Should be 70-160 chars.", "recommendation": "Write a compelling meta description of at least 70 characters."})
        else:
            issues.append({"severity": "warning", "check": "Meta Description", "message": f"Description too long ({result['description_length']} chars).", "recommendation": "Trim to 160 characters max."})
    else:
        issues.append({"severity": "warning", "check": "Meta Description", "message": "Missing meta description.", "recommendation": "Add a meta description tag for better SERP snippets."})

    # Canonical
    canonical = soup.find("link", rel="canonical")
    if canonical:
        result["canonical"] = canonical.get("href", "")

    # Robots
    robots = soup.find("meta", attrs={"name": "robots"})
    if robots:
        result["robots"] = robots.get("content", "")

    # Hreflang
    for link in soup.find_all("link", rel="alternate"):
        hreflang = link.get("hreflang")
        if hreflang:
            result["hreflang"].append({"lang": hreflang, "href": link.get("href", "")})

    # Viewport
    viewport = soup.find("meta", attrs={"name": "viewport"})
    if viewport:
        result["viewport"] = viewport.get("content", "")
    else:
        issues.append({"severity": "warning", "check": "Viewport", "message": "Missing viewport meta tag.", "recommendation": "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> for mobile responsiveness."})

    # OG tags
    for og_tag, og_field, og_name in [
        ("og:title", "og_title", "OG Title"),
        ("og:description", "og_description", "OG Description"),
        ("og:image", "og_image", "OG Image"),
        ("og:type", "og_type", "OG Type"),
    ]:
        tag = soup.find("meta", property=og_tag)
        if tag:
            result[og_field] = tag.get("content", "")
        elif og_tag == "og:image":
            issues.append({"severity": "warning", "check": og_name, "message": f"Missing {og_tag} tag.", "recommendation": "Add an OG image for better social sharing previews."})

    # Twitter card
    twitter = soup.find("meta", attrs={"name": "twitter:card"})
    if twitter:
        result["twitter_card"] = twitter.get("content", "")

    return result


def _analyze_headings(soup: BeautifulSoup, issues: list[dict]) -> dict:
    """Analizuje strukturę nagłówków."""
    heading_list: list[dict] = []
    h1_count = 0
    prev_level = 0
    skipped_levels: list[str] = []

    for tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
        level = int(tag.name[1])
        text = tag.get_text(strip=True)
        if text and len(text) > 1:
            heading_list.append({"level": level, "text": text[:200], "tag": tag.name})

        if tag.name == "h1":
            h1_count += 1

        # Check for skipped levels (e.g., H1 → H3 skips H2)
        if prev_level > 0 and level > prev_level + 1:
            skipped_tag = f"h{prev_level + 1}"
            if skipped_tag not in skipped_levels:
                skipped_levels.append(skipped_tag)
        prev_level = max(level, prev_level)

    # Validate H1 count
    if h1_count == 0:
        issues.append({"severity": "error", "check": "H1 Tag", "message": "No H1 heading found.", "recommendation": "Add exactly one H1 tag containing the primary keyword."})
    elif h1_count > 1:
        issues.append({"severity": "error", "check": "H1 Tag", "message": f"Multiple H1 tags found ({h1_count}).", "recommendation": "Use exactly one H1 per page."})

    # Validate heading hierarchy
    if skipped_levels:
        issues.append({"severity": "warning", "check": "Heading Hierarchy", "message": f"Skipped heading levels: {', '.join(skipped_levels)}.", "recommendation": "Maintain proper heading hierarchy: H1 → H2 → H3 without skipping levels."})

    total = len(heading_list)
    h2_count = sum(1 for h in heading_list if h["tag"] == "h2")
    if total > 2 and h2_count == 0:
        issues.append({"severity": "warning", "check": "H2 Tags", "message": "No H2 headings found but content has other headings.", "recommendation": "Structure content with H2 sections for better readability and SEO."})

    return {"list": heading_list, "total": total, "h1_count": h1_count, "h2_count": h2_count}


def _analyze_content(soup: BeautifulSoup, html: str, base_url: str, issues: list[dict]) -> dict:
    """Analizuje treść strony: słowa, paragrafy, linki, listy."""
    # Remove scripts and styles for text extraction
    for tag in soup(["script", "style", "nav", "footer", "noscript"]):
        tag.decompose()

    # Get main content candidates
    main_selectors = [
        "article", "[role='main']", "main",
        ".post-content", ".entry-content", ".article-content", ".article-body",
        ".content-body", ".blog-content", ".post-body", "#content", "#main-content",
    ]
    main_el = soup.find("body")
    for sel in main_selectors:
        el = soup.select_one(sel)
        if el:
            main_el = el
            break

    # Text stats
    body_text = main_el.get_text(separator=" ", strip=True) if main_el else ""
    words = body_text.split()
    word_count = len(words)
    text_sample = " ".join(words[:500])

    # Paragraphs
    paragraphs = main_el.find_all("p") if main_el else []
    para_texts = [p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 30]
    para_count = len(para_texts)

    # Thin content check
    if word_count < 300:
        issues.append({"severity": "warning", "check": "Content Length", "message": f"Thin content ({word_count} words).", "recommendation": "Add at least 300+ words of substantive content."})
    if para_count < 3:
        issues.append({"severity": "warning", "check": "Paragraphs", "message": f"Only {para_count} substantial paragraphs.", "recommendation": "Structure content into more paragraphs for readability."})

    # Lists
    ol_count = len(main_el.find_all("ol")) if main_el else 0
    ul_count = len(main_el.find_all("ul")) if main_el else 0

    # Links (using full soup, not just main content)
    internal_links = 0
    external_links = 0
    domain = urlparse(base_url).netloc

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:"):
            continue
        parsed = urlparse(href)
        if not parsed.netloc or parsed.netloc == domain:
            internal_links += 1
        else:
            external_links += 1

    # Bold/strong tags
    bold_count = len(soup.find_all(["strong", "b"]))

    return {
        "word_count": word_count,
        "text_sample": text_sample[:2000],
        "paragraph_count": para_count,
        "ol_count": ol_count,
        "ul_count": ul_count,
        "internal_links": internal_links,
        "external_links": external_links,
        "bold_count": bold_count,
    }


def _analyze_images(soup: BeautifulSoup, issues: list[dict]) -> dict:
    """Audyt obrazów: alt text, liczba."""
    imgs = soup.find_all("img")
    img_count = len(imgs)
    without_alt = 0
    without_dimensions = 0

    for img in imgs:
        alt = img.get("alt", "")
        if not alt or not alt.strip():
            without_alt += 1
        src = img.get("src", "")
        if not img.get("width") and not img.get("height"):
            without_dimensions += 1

    if without_alt > 0:
        issues.append({"severity": "warning", "check": "Image Alt Text", "message": f"{without_alt} of {img_count} images missing alt text.", "recommendation": "Add descriptive alt attributes to all images for accessibility and image SEO."})

    if without_dimensions > 0 and without_dimensions >= img_count * 0.5:
        issues.append({"severity": "warning", "check": "Image Dimensions", "message": f"{without_dimensions} images missing explicit width/height.", "recommendation": "Add width and height attributes to prevent layout shifts (CLS)."})

    return {"total": img_count, "without_alt": without_alt, "without_dimensions": without_dimensions}


def _analyze_schema(soup: BeautifulSoup, issues: list[dict]) -> dict:
    """Wykrywa schema.org JSON-LD na stronie."""
    schemas = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "{}")
            if isinstance(data, list):
                schemas.extend(data)
            else:
                schemas.append(data)
        except (json.JSONDecodeError, TypeError):
            pass

    schema_types = []
    for s in schemas:
        t = s.get("@type", "")
        if isinstance(t, list):
            schema_types.extend(t)
        elif t:
            schema_types.append(t)

    if not schemas:
        issues.append({"severity": "warning", "check": "Structured Data", "message": "No JSON-LD structured data found.", "recommendation": "Add schema.org structured data (Article, FAQ, BreadcrumbList) for rich results."})

    return {"count": len(schemas), "types": schema_types}


def _detect_tech(html: str, url: str) -> dict:
    """Wykrywa technologie na podstawie HTML."""
    tech = {"cms": [], "analytics": [], "cdn": []}

    # CMS hints
    if "/wp-content/" in html or "/wp-includes/" in html or 'class="wp-' in html:
        tech["cms"].append("WordPress")
    if "shopify" in html.lower() or "cdn.shopify.com" in html:
        tech["cms"].append("Shopify")
    if "<div id=\"root\"" in html or "_next/" in html:
        tech["cms"].append("Next.js / React")

    # Analytics
    if "gtag" in html or "googletagmanager" in html:
        tech["analytics"].append("Google Analytics / GTM")
    if "facebook.com" in html and "pixel" in html.lower():
        tech["analytics"].append("Facebook Pixel")

    # CDN
    if "cdnjs.cloudflare.com" in html:
        tech["cdn"].append("Cloudflare CDN")
    if "cdn.jsdelivr.net" in html:
        tech["cdn"].append("jsDelivr")

    return tech


def _compute_audit_score(issues: list[dict]) -> int:
    """Kalkuluje ogólny wynik audytu 0-100."""
    base = 100
    for issue in issues:
        if issue["severity"] == "error":
            base -= 15
        else:
            base -= 5
    return max(0, base)


# ── Helpers ──────────────────────────────────────────────────────────────

def _detect_tone(text: str) -> str:
    """Heurystyka tonu wypowiedzi."""
    if not text:
        return "neutral"
    text_lower = text.lower()

    formal_words = ["furthermore", "therefore", "however", "moreover", "consequently",
                    "jednakże", "ponadto", "niemniej", "w związku", "w konsekwencji",
                    "należy", "wskazane jest", "rekomenduje się", "zgodnie z",
                    "w odniesieniu do", "w szczególności"]
    casual_words = ["hey", "awesome", "wow", "cool", "check out", "cześć", "super", "hej",
                    "spoko", "fajnie", "no więc", "w sumie", "po prostu"]

    formal_score = sum(1 for w in formal_words if w in text_lower)
    casual_score = sum(1 for w in casual_words if w in text_lower)

    if formal_score > casual_score + 2:
        return "professional"
    if casual_score > formal_score + 2:
        return "casual"
    return "neutral"


def _detect_language_heuristic(text: str) -> str:
    """Prosta detekcja języka przez znaki specjalne."""
    if not text:
        return "pl"
    # Polish-specific chars
    pl_chars = set("ąćęłńóśźż")
    text_chars = set(text[:500].lower())
    if len(pl_chars & text_chars) >= 3:
        return "pl"
    return "en"


def _empty_context(url: str) -> dict:
    return {
        "url": url,
        "final_url": url,
        "title": "",
        "description": "",
        "tone": "professional",
        "language": "pl",
        "topics": [],
        "h_tags": [],
        "text_sample": "",
        "meta": {},
        "headings": {"list": [], "total": 0, "h1_count": 0, "h2_count": 0},
        "content": {"word_count": 0, "text_sample": "", "paragraph_count": 0, "ol_count": 0, "ul_count": 0, "internal_links": 0, "external_links": 0, "bold_count": 0},
        "images": {"total": 0, "without_alt": 0, "without_dimensions": 0},
        "schema": {"count": 0, "types": []},
        "tech": {"cms": [], "analytics": [], "cdn": []},
        "issues": [],
        "issue_count": 0,
        "issue_count_error": 0,
        "issue_count_warning": 0,
        "score": 0,
    }
