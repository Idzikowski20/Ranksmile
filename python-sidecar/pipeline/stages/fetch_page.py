"""Stage 1: Fetch page content. Plain HTTP with SPA fallback."""
import os
import httpx
from bs4 import BeautifulSoup
from pipeline.contracts import AnalysisStage, StageContext

NEXTJS_URL = os.getenv("NEXTJS_URL", "http://127.0.0.1:3000")


class FetchPageStage(AnalysisStage):
    name = "fetch_page"
    progress_weight = 0.15

    async def run(self, ctx: StageContext) -> dict:
        url = ctx.payload.get("url", "")
        if not url:
            raise ValueError("url is required in payload")

        html = await self._fetch(url)
        soup = BeautifulSoup(html, "lxml")

        # Extract rich metadata for downstream stages (scorer, classifier)
        title_tag = soup.find("title")
        h1_tag = soup.find("h1")
        desc_tag = soup.find("meta", attrs={"name": "description"})
        canonical_tag = soup.find("link", rel="canonical")
        og_title = soup.find("meta", property="og:title")
        og_desc = soup.find("meta", property="og:description")
        og_image = soup.find("meta", property="og:image")

        # Content stats (on cleaned soup — without scripts/nav etc.)
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
            tag.decompose()

        headings = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
        paragraphs = [p for p in soup.find_all("p") if len(p.get_text(strip=True)) > 30]
        imgs = soup.find_all("img")
        imgs_without_alt = sum(1 for img in imgs if not img.get("alt", "").strip())

        return {
            "url": url,
            "html": html,
            "title": h1_tag.get_text(strip=True) if h1_tag else (title_tag.get_text(strip=True) if title_tag else url),
            "meta_title": title_tag.get_text(strip=True) if title_tag else "",
            "meta_description": desc_tag.get("content", "") if desc_tag else "",
            "canonical": canonical_tag.get("href", "") if canonical_tag else "",
            "og_title": og_title.get("content", "") if og_title else "",
            "og_description": og_desc.get("content", "") if og_desc else "",
            "og_image": og_image.get("content", "") if og_image else "",
            "heading_count": len(headings),
            "paragraph_count": len(paragraphs),
            "image_count": len(imgs),
            "images_without_alt": imgs_without_alt,
            # Basic issues detected during fetch
            "issues": _detect_fetch_issues(title_tag, desc_tag, h1_tag, headings, imgs, imgs_without_alt),
        }

    async def _fetch(self, url: str) -> str:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            resp.raise_for_status()
            html = resp.text

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
                    f"{NEXTJS_URL}/api/render-page",
                    json={"url": url, "timeout": 15000},
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
