"""
Generowanie obrazów dla artykułów SEO.
  1. DeepSeek prompt enrichment — zamienia heading w szczegółowy prompt do generowania obrazu
  2. Pollinations.ai — generowanie obrazu 1920x1080, 16:9
"""
import asyncio
import os
import base64
import hashlib
import unicodedata
import httpx
from urllib.parse import quote

# Pollinations free tier: max 1 concurrent request per IP
# Semaphore ensures only 1 in-flight request at a time
_pollinations_sem = asyncio.Semaphore(1)


def _ascii_prompt(text: str) -> str:
    """Usuwa polskie znaki diakrytyczne — Pollinations lepiej obsługuje ASCII."""
    normalized = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in normalized if ord(c) < 128)


async def _enrich_prompt_with_ai(keyword: str, title: str) -> str:
    """
    Wysyła heading do DeepSeek, który tworzy szczegółowy, obrazowy prompt
    opisujący co dokładnie ma być przedstawione na obrazie.
    """
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        print("[image] No DEEPSEEK_API_KEY — using raw prompt")
        return ""

    system_prompt = """You are an expert visual prompt engineer for SEO article images.

PROCESS — You MUST think through these 3 questions internally before writing the prompt:
1. WHAT does this heading actually mean? (specific facts, not Hollywood clichés)
2. What does this LOOK LIKE in real life? (what would a journalist or investigator photograph?)
3. What's the most compelling angle? (close-up on evidence? wide scene? action shot?)

RULES:
- Describe a REALISTIC, JOURNALISTIC scene — like a documentary photograph, NOT a movie poster
- Show actual evidence/situations: documents, objects, environments, real human actions
- Include: lighting style, composition, camera angle, color palette, mood
- Write in English only, max 250 characters
- NO: charts, diagrams, UI screens, text overlays, watermarks
- NO HOLLYWOOD CLICHÉS: no dark offices with men in suits handing envelopes, no handshakes, no people smiling at laptops, no generic stock photography

OUTPUT FORMAT:
First think through the 3 questions briefly (1-2 lines), then write the final prompt on a new line starting with PROMPT:
Example:
1. This heading is about fraud detection in corporate accounting — showing how fake invoices get caught
2. A forensic accountant examining suspicious paperwork, red flags highlighted, calculator and audit reports on desk
3. Close-up over the shoulder shot showing the hands and documents in detail
PROMPT: close-up over shoulder shot of forensic accountant examining suspicious invoices with red flags, calculator and audit reports on desk, natural office lighting, shallow depth of field, muted color palette"""

    user_prompt = f"""Heading: "{title}"
Article topic: "{keyword}"

Analyze this heading through the 3 questions and create a realistic journalistic photography prompt."""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                json={
                    "model": "deepseek-chat",
                    "max_tokens": 300,
                    "temperature": 0.7,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                raw = data["choices"][0]["message"]["content"].strip()

                # Extract prompt after PROMPT: delimiter
                prompt_marker = "PROMPT:"
                marker_idx = raw.upper().find(prompt_marker)
                if marker_idx >= 0:
                    enriched = raw[marker_idx + len(prompt_marker):].strip().strip('"').strip("'")
                else:
                    # Fallback: use the last non-empty line if no PROMPT: found
                    lines = [l.strip() for l in raw.split('\n') if l.strip()]
                    enriched = lines[-1] if lines else raw
                    enriched = enriched.strip('"').strip("'")

                print(f"[image] DeepSeek raw response ({len(raw)} chars): {raw[:200]}...")
                print(f"[image] DeepSeek enriched prompt: {enriched[:150]}...")
                return enriched
            else:
                print(f"[image] DeepSeek enrichment failed (HTTP {resp.status_code}): {resp.text[:200]}")
                return ""
    except Exception as e:
        print(f"[image] DeepSeek enrichment error: {e}")
        return ""


def _build_prompt(keyword: str, title: str, style: str) -> str:
    """Fallback prompt when DeepSeek enrichment is unavailable."""
    style_map = {
        "professional": "professional editorial photography, clean modern office style, sharp focus, 4K, ultra high resolution",
        "casual": "friendly lifestyle photography, warm natural colors, candid feel, 4K, ultra high resolution",
        "neutral": "neutral clean white background, modern minimalist, informational, 4K, ultra high resolution",
    }
    style_desc = style_map.get(style, style_map["professional"])
    kw_ascii = _ascii_prompt(keyword)
    title_ascii = _ascii_prompt(title)[:60]
    return (
        f"cinematic wide landscape hero image about {kw_ascii}, "
        f"context: {title_ascii}, "
        f"{style_desc}, widescreen 16:9 composition, no text overlays, no watermarks, no letterboxing"
    )


async def generate_article_image(keyword: str, article_title: str, style: str = "professional") -> dict:
    """
    Generuje obraz przez Pollinations.ai (Flux Schnell).
    1. DeepSeek wzbogaca heading w szczegółowy prompt (jeśli dostępny klucz API)
    2. Pollinations generuje obraz
    Zwraca dict z url (data URI base64), alt, width, height, source.
    """
    # Step 1: Try AI prompt enrichment
    enriched = await _enrich_prompt_with_ai(keyword, article_title)
    if enriched:
        # Prepend quality/style keywords to the enriched prompt
        prompt = f"{enriched}, cinematic 16:9 widescreen composition, 4K, ultra high resolution, professional editorial photography, no text, no watermarks"
    else:
        prompt = _build_prompt(keyword, article_title, style)

    # SEO-friendly alt text: use the original heading + keyword (in article's language)
    alt_text = f"{article_title} - {keyword}".strip()[:200]

    return await _pollinations_fetch(prompt, alt_text)


def _pollinations_url(prompt: str) -> str:
    """Public Pollinations URL (browser/CDN fetch) — preferred for article HTML (no multi-MB data URI)."""
    seed = int(hashlib.md5(prompt.encode()).hexdigest()[:8], 16) % 1000000
    encoded = quote(prompt, safe="")
    api_key = os.getenv("POLLINATIONS_API_KEY", "")
    token_param = f"&token={api_key}" if api_key else ""
    return (
        f"https://image.pollinations.ai/prompt/{encoded}"
        f"?width=1920&height=1080&nologo=true&private=true&seed={seed}&enhance=true&model=flux-schnell{token_param}"
    )


def _surfer_style_alt(heading: str, keyword: str, language: str = "pl") -> str:
    if (language or "pl").lower().startswith("pl"):
        return (
            f"Na zdjęciu widać scenę związaną z tematem „{heading}” w kontekście {keyword}. "
            f"Ilustracja podkreśla praktyczne aspekty omawiane w tej części artykułu."
        )[:400]
    return (
        f"Illustration related to “{heading}” in the context of {keyword}, "
        f"highlighting practical aspects covered in this section."
    )[:400]


async def generate_article_image_for_embed(
    keyword: str,
    article_title: str,
    style: str = "professional",
    language: str = "pl",
) -> dict:
    """
    For mid-article <img src>: return Pollinations CDN URL (not base64).
    Warm the cache with one server GET (fail-soft — URL still returned).
    """
    enriched = await _enrich_prompt_with_ai(keyword, article_title)
    if enriched:
        prompt = (
            f"{enriched}, cinematic 16:9 widescreen composition, 4K, ultra high resolution, "
            f"professional editorial photography, no text, no watermarks"
        )
    else:
        prompt = _build_prompt(keyword, article_title, style)

    alt_text = _surfer_style_alt(article_title, keyword, language)
    url = _pollinations_url(prompt)

    # Warm generation so first editor load isn't a cold Pollinations miss.
    try:
        async with _pollinations_sem:
            headers = {}
            api_key = os.getenv("POLLINATIONS_API_KEY", "")
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            async with httpx.AsyncClient(timeout=90, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                print(f"[image] Warm-fetch HTTP {resp.status_code} — still embedding URL")
            else:
                print(f"[image] Warm-fetch OK ({len(resp.content)//1024} KB) for embed")
    except Exception as e:
        print(f"[image] Warm-fetch skipped: {e}")

    return {
        "url": url,
        "alt": alt_text,
        "width": 1920,
        "height": 1080,
        "source": "pollinations",
    }


async def _pollinations_fetch(prompt: str, alt_text: str = "") -> dict:
    """
    Pobiera obraz z Pollinations.ai po stronie serwera i zwraca jako data URI (base64).
    Retry z backoffem dla 402 (rate limit) — Pollinations free tier: max 1 concurrent req/IP.
    """
    seed = int(hashlib.md5(prompt.encode()).hexdigest()[:8], 16) % 1000000
    encoded = quote(prompt, safe='')
    api_key = os.getenv("POLLINATIONS_API_KEY", "")

    token_param = f"&token={api_key}" if api_key else ""
    url = (
        f"https://image.pollinations.ai/prompt/{encoded}"
        f"?width=1920&height=1080&nologo=true&private=true&seed={seed}&enhance=true&model=flux-schnell{token_param}"
    )

    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    last_error = None
    max_retries = 4
    async with _pollinations_sem:
        for attempt in range(max_retries + 1):
            auth_label = "yes" if api_key else "no"
            print(f"[image] Fetching from Pollinations (auth={auth_label}, attempt={attempt + 1}/{max_retries + 1}): {url[:120]}...")

            async with httpx.AsyncClient(timeout=90, follow_redirects=True) as client:
                response = await client.get(url, headers=headers)

            print(f"[image] Pollinations response: HTTP {response.status_code}, content-type: {response.headers.get('content-type', '?')}, size: {len(response.content)} bytes")

            if response.status_code == 200:
                break

            # 402 = rate limit / queue full, 429 = too many requests — retryable
            if response.status_code in (402, 429) and attempt < max_retries:
                delay = (2 ** attempt) + (hash(prompt + str(attempt)) % 1000) / 1000.0  # 1–1.9s, 2–2.9s, 4–4.9s, 8–8.9s
                error_body = response.text[:300]
                print(f"[image] Rate limited ({response.status_code}), retrying in {delay:.1f}s. Body: {error_body}")
                await asyncio.sleep(delay)
                last_error = Exception(f"Pollinations HTTP {response.status_code}: {error_body}")
                continue

            # Non-retryable error
            error_text = response.text[:500]
            print(f"[image] Pollinations error body: {error_text}")
            last_error = Exception(f"Pollinations HTTP {response.status_code}: {error_text}")

        if last_error is not None:
            raise last_error

    img_bytes = response.content
    content_type = response.headers.get("content-type", "image/jpeg").split(";")[0].strip()

    # Pollinations sometimes returns HTML error pages — detect and raise
    if "text/html" in content_type or (len(img_bytes) < 1000 and b"<html" in img_bytes[:200]):
        print(f"[image] Pollinations returned HTML instead of image: {img_bytes[:300]}")
        raise Exception(f"Pollinations returned non-image response (content-type: {content_type})")

    b64 = base64.b64encode(img_bytes).decode("utf-8")
    data_url = f"data:{content_type};base64,{b64}"

    print(f"[image] Pollinations OK — {len(img_bytes)//1024} KB, type={content_type}")
    return {
        "url": data_url,
        "alt": (alt_text or prompt)[:200],
        "width": 1920,
        "height": 1080,
        "source": "pollinations",
    }
