"""Stage 1: Fetch page content. Plain HTTP with SPA fallback."""
import os
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from pipeline.contracts import AnalysisStage, StageContext
from pipeline.ssrf_guard import assert_public_url

from service_urls import nextjs_url


class FetchPageStage(AnalysisStage):
    name = "fetch_page"
    progress_weight = 0.15

    def can_skip(self, ctx: StageContext) -> bool:
        # New-content (keyword-only) analysis has no page to fetch — the rest of
        # the pipeline (SERP, terms, AI search) runs off the keyword alone.
        return not ctx.payload.get("url")

    async def run(self, ctx: StageContext) -> dict:
        url = ctx.payload.get("url", "")
        if not url:
            raise ValueError("url is required in payload")

        raw_html = await self._fetch(url)
        soup = BeautifulSoup(raw_html, "lxml")

        # Extract rich metadata from original soup (before cleaning)
        title_tag = soup.find("title")
        h1_tag = soup.find("h1")
        desc_tag = soup.find("meta", attrs={"name": "description"})
        canonical_tag = soup.find("link", rel="canonical")
        og_title = soup.find("meta", property="og:title")
        og_desc = soup.find("meta", property="og:description")
        og_image = soup.find("meta", property="og:image")

        # Extract featured image: og:image first, then first large img in article
        featured_image = og_image.get("content", "") if og_image else ""

        # Remove non-content elements
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
            tag.decompose()

        # ── Extract main article content ────────────────────────────
        article = None
        # 1. Try semantic + WordPress/theme content selectors (ordered by specificity)
        content_selectors = [
            "article",
            "main",
            "section.single-post-section",
            ".post-content",
            ".entry-content",
            ".article-content",
            ".content-area",
            ".post-body",
            ".site-content.post",
            '[role="main"]',
            "#content",
            ".site-content",
        ]
        for selector in content_selectors:
            article = soup.select_one(selector)
            if article:
                # Verify it has substantial content (not just post meta / empty container)
                text_len = len(article.get_text(separator=" ", strip=True).split())
                if text_len >= 100:
                    break
                article = None  # Too small, try next selector

        if not article:
            article = soup.find("body") or soup

        def _img_real_src(img) -> str:
            """Resolve real image URL — handles lazy loading (data-src, data-lazy-src)."""
            return img.get("data-src") or img.get("data-lazy-src") or img.get("src") or ""

        # Featured image fallback: first real img inside article
        if not featured_image:
            first_img = article.find("img")
            if first_img:
                featured_image = _img_real_src(first_img)

        # Extract content images (skip base64 placeholders / SVG data URIs)
        content_imgs = article.find_all("img")
        img_urls = []
        for img in content_imgs:
            src = _img_real_src(img)
            if src and not src.startswith("data:"):
                img_urls.append({
                    "src": src,
                    "alt": img.get("alt", ""),
                    "width": img.get("width", ""),
                    "height": img.get("height", ""),
                })

        # Stats on cleaned article content
        headings = article.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
        paragraphs = [p for p in article.find_all("p") if len(p.get_text(strip=True)) > 30]
        imgs_without_alt = sum(1 for img in content_imgs if not img.get("alt", "").strip())

        # Build clean content HTML from article content
        content_html = str(article)

        return {
            "url": url,
            "html": content_html,
            "featured_image": featured_image,
            "content_images": img_urls,
            "title": h1_tag.get_text(strip=True) if h1_tag else (title_tag.get_text(strip=True) if title_tag else url),
            "meta_title": title_tag.get_text(strip=True) if title_tag else "",
            "meta_description": desc_tag.get("content", "") if desc_tag else (og_desc.get("content", "") if og_desc else ""),
            "canonical": canonical_tag.get("href", "") if canonical_tag else "",
            "og_title": og_title.get("content", "") if og_title else "",
            "og_description": og_desc.get("content", "") if og_desc else "",
            "og_image": og_image.get("content", "") if og_image else "",
            "heading_count": len(headings),
            "paragraph_count": len(paragraphs),
            "image_count": len(content_imgs),
            "images_without_alt": imgs_without_alt,
            "issues": _detect_fetch_issues(title_tag, desc_tag, h1_tag, headings, content_imgs, imgs_without_alt),
        }

    async def _fetch(self, url: str) -> str:
        current_url = url
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
            for _ in range(5):
                assert_public_url(current_url)
                resp = await client.get(current_url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                })
                if 300 <= resp.status_code < 400:
                    location = resp.headers.get("location")
                    if not location:
                        resp.raise_for_status()
                        html = resp.text
                        break
                    current_url = urljoin(current_url, location)
                    continue
                resp.raise_for_status()
                html = resp.text
                break
            else:
                raise ValueError("Too many redirects")

        # SPA fallback check
        soup = BeautifulSoup(html, "lxml")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        if len(text.split()) < 200:
            html = await self._spa_fallback(url) or html

        return html

    async def _spa_fallback(self, url: str) -> str | None:
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                resp = await client.post(
                    f"{nextjs_url()}/api/render-page",
                    json={"url": url, "timeout": 15000},
                    headers={"x-internal-token": os.getenv("INTERNAL_PIPELINE_TOKEN", "")},
                )
                resp.raise_for_status()
                data = resp.json()
                if data.get("html"):
                    print(f"[fetch_page] SPA fallback success for {url}")
                    return data["html"]
        except Exception as exc:
            print(f"[fetch_page] SPA fallback failed for {url}: {exc}")
        return None


def _detect_fetch_issues(title_tag, desc_tag, h1_tag, headings, imgs, imgs_without_alt) -> list[dict]:
    issues = []
    title_text = title_tag.get_text(strip=True) if title_tag else ""
    if not title_text:
        issues.append({"severity": "error", "check": "Meta Title", "message": "Missing <title> tag."})
    elif not (30 <= len(title_text) <= 65):
        issues.append({"severity": "warning", "check": "Meta Title", "message": f"Title length {len(title_text)} — should be 30-65 chars."})

    desc_text = desc_tag.get("content", "") if desc_tag else ""
    if not desc_text:
        issues.append({"severity": "warning", "check": "Meta Description", "message": "Missing meta description."})

    h1_count = sum(1 for h in headings if h.name == "h1")
    if h1_count == 0:
        issues.append({"severity": "error", "check": "H1 Tag", "message": "No H1 heading found."})
    elif h1_count > 1:
        issues.append({"severity": "error", "check": "H1 Tag", "message": f"Multiple H1 tags found ({h1_count})."})

    if imgs_without_alt > 0:
        issues.append({"severity": "warning", "check": "Image Alt Text", "message": f"{imgs_without_alt}/{len(imgs)} images missing alt text."})

    return issues
