"""
Surfer-style mid-article images: pick H2 slots → Pollinations → inject <img> + PL alt.
Fail-soft: any error leaves HTML unchanged.
"""
from __future__ import annotations

import re
from bs4 import BeautifulSoup

from analyzers.image_generator import generate_article_image_for_embed

# Skip tail sections — FAQ/Summary stay text-only (Surfer also rarely images those).
_SKIP_H2 = re.compile(
    r"faq|podsumowan|summary|najcz[eę]stsze pytania|częste pytania",
    re.I,
)

MAX_INLINE_IMAGES = 4


def pick_image_headings(html: str, max_images: int = MAX_INLINE_IMAGES) -> list[str]:
    """Return H2 texts that should get an image after their section body."""
    soup = BeautifulSoup(html or "", "lxml")
    h2s = soup.find_all("h2")
    body = []
    for h in h2s:
        text = h.get_text(" ", strip=True)
        if not text or _SKIP_H2.search(text):
            continue
        body.append(text)
    if len(body) < 2:
        return []
    # Skip first content H2 (intro/quick start); space remaining evenly.
    candidates = body[1:]
    if not candidates:
        return []
    n = min(max_images, len(candidates))
    if n <= 0:
        return []
    if len(candidates) <= n:
        return candidates
    step = len(candidates) / n
    picked: list[str] = []
    for i in range(n):
        idx = min(len(candidates) - 1, int(i * step))
        heading = candidates[idx]
        if heading not in picked:
            picked.append(heading)
    return picked[:max_images]


def _default_alt(heading: str, keyword: str, language: str) -> str:
    if (language or "pl").lower().startswith("pl"):
        return (
            f"Na zdjęciu widać scenę związaną z tematem „{heading}” w kontekście {keyword}. "
            f"Ilustracja podkreśla praktyczne aspekty omawiane w tej części artykułu."
        )
    return (
        f"Illustration related to “{heading}” in the context of {keyword}, "
        f"highlighting practical aspects covered in this section."
    )


def inject_img_after_section(html: str, heading: str, src: str, alt: str) -> str:
    """Insert <img> just before the next H2 (end of section) or at end of article."""
    soup = BeautifulSoup(html or "", "lxml")
    target = None
    for h in soup.find_all("h2"):
        if h.get_text(" ", strip=True) == heading:
            target = h
            break
    if target is None:
        return html

    img = soup.new_tag(
        "img",
        src=src,
        alt=(alt or "")[:400],
        loading="lazy",
        width="1920",
        height="1080",
    )

    nxt = target.find_next_sibling("h2")
    if nxt is not None:
        nxt.insert_before(img)
    else:
        # Last body section — append after last content under this h2
        insert_at = target
        sib = target.next_sibling
        while sib is not None:
            nxt_sib = sib.next_sibling
            if getattr(sib, "name", None) == "h2":
                break
            insert_at = sib
            sib = nxt_sib
        if getattr(insert_at, "insert_after", None):
            insert_at.insert_after(img)
        else:
            target.insert_after(img)

    body = soup.body
    if body is not None:
        return "".join(str(c) for c in body.children)
    return str(soup)


async def inject_inline_images(
    html: str,
    keyword: str,
    language: str = "pl",
    max_images: int = MAX_INLINE_IMAGES,
) -> str:
    if not html or not keyword:
        return html
    headings = pick_image_headings(html, max_images=max_images)
    if not headings:
        print("[images] No H2 slots for inline images")
        return html

    out = html
    for heading in headings:
        try:
            result = await generate_article_image_for_embed(keyword, heading, language=language)
            url = (result or {}).get("url") or ""
            if not url:
                continue
            alt = (result.get("alt") or "").strip() or _default_alt(heading, keyword, language)
            out = inject_img_after_section(out, heading, url, alt)
            print(f"[images] Injected after H2: {heading[:60]}")
        except Exception as exc:
            print(f"[images] Skip slot '{heading[:40]}': {exc}")
            continue
    return out


# ponytail: ceiling = even H2 sampling + Pollinations URL (no R2 in sidecar); upgrade = R2 mirror + vision QA
if __name__ == "__main__":
    sample = (
        "<h1>T</h1><h2>Szybka odpowiedź</h2><p>a</p>"
        "<h2>Plan działania</h2><p>b</p>"
        "<h2>Najczęstsze błędy</h2><p>c</p>"
        "<h2>FAQ</h2><p>d</p>"
        "<h2>Podsumowanie</h2><p>e</p>"
    )
    picked = pick_image_headings(sample, max_images=4)
    assert "FAQ" not in picked and "Podsumowanie" not in picked
    assert "Plan działania" in picked or "Najczęstsze błędy" in picked
    injected = inject_img_after_section(sample, "Plan działania", "https://example.com/x.png", "alt test")
    assert "<img" in injected and "alt test" in injected
    print("article_images self-check OK", picked)
