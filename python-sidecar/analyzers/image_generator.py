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


def _inert(text: str, limit: int = 200) -> str:
    """
    Flatten a DB-sourced value before it is interpolated into the LLM prompt.

    `title` and `keyword` are attacker-influenced (a competitor controls the page a
    keyword is scraped from), and newlines or quotes in them let the value read as a new
    instruction rather than data.
    """
    return " ".join(str(text or "").split()).replace('"', "'").replace("`", "'")[:limit]


def _safe_alt(text: str) -> str:
    """
    Alt text is returned as JSON from /generate-image and written into article HTML, so
    the characters that could close an attribute or open a tag are removed here rather
    than trusted to every consumer. Not html.escape: BeautifulSoup escapes the attribute
    on the injection path, and escaping twice renders `&quot;` to the reader.

    BOTH quote characters go, not just the double one. `alt='...'` is as valid as
    `alt="..."`, so leaving `'` intact left the same break-out open — an earlier version
    even swapped `"` for `'`, which produced the dangerous character from the safe one.
    `&` goes too: it starts an entity, and a consumer that escapes once more would render
    the mangled result to the reader. It becomes a space, not a conjunction — an earlier
    version substituted the Polish "i", which corrupted German, Spanish and every other
    localised alt the moment the model wrote an ampersand. Quotes become typographic so
    the sentence still reads as prose in any language.
    """
    cleaned = " ".join(str(text or "").split())
    for bad, good in (("<", ""), (">", ""), ("&", " "), ('"', "”"), ("'", "’")):
        cleaned = cleaned.replace(bad, good)
    return " ".join(cleaned.split())[:300]


LANGUAGE_NAMES = {
    "cs": "Czech", "da": "Danish", "de": "German", "el": "Greek", "en": "English",
    "es": "Spanish", "fi": "Finnish", "fr": "French", "hu": "Hungarian", "it": "Italian",
    "ja": "Japanese", "nl": "Dutch", "no": "Norwegian", "pl": "Polish",
    "pt": "Portuguese", "ro": "Romanian", "sk": "Slovak", "sv": "Swedish",
    "tr": "Turkish", "uk": "Ukrainian",
}


def _language_name(language: str | None) -> str:
    """
    Locale code -> language name for the alt-text instruction.

    Was "Polish if it starts with pl, else English", so a German or Spanish article got
    English alt text while its body was written in its own language — the one string on
    the page a screen reader and Google Images actually read.

    The codes are every `code` in lib/setupLocations.ts, the list the workspace creator
    offers. A first pass covered only the obvious European ones and left Finnish,
    Hungarian, Turkish, Greek and Japanese on the English fallback.
    """
    code = (language or "pl").strip().lower().replace("_", "-").split("-")[0]
    return LANGUAGE_NAMES.get(code, "English")


async def _enrich_prompt_with_ai(keyword: str, title: str, language: str = "pl") -> tuple[str, str]:
    """
    Wysyła heading do DeepSeek, który tworzy szczegółowy, obrazowy prompt
    opisujący co dokładnie ma być przedstawione na obrazie — oraz alt text.

    Zwraca (prompt, alt). Alt powstaje w tym samym wywołaniu, bo model właśnie
    opisał scenę: alt sklejany z "{heading} - {keyword}" nie mówił nic o tym, co
    faktycznie widać na obrazku, więc nie pomagał ani czytnikom ekranu, ani Grafice
    Google. Puste wartości = brak klucza lub błąd; caller ma wtedy fallback.
    """
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        print("[image] No DEEPSEEK_API_KEY — using raw prompt")
        return "", ""

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

ALT TEXT — a second, separate job. After the prompt, write the alt attribute for this
image: one sentence describing what is actually VISIBLE in the scene you just specified,
in the article's language, 90-140 characters, containing the article topic naturally.
Describe the scene, not the article. Never start with "Obraz przedstawiajacy", "Na obrazie",
"Image of" or "Zdjecie" — a screen reader already announces that it is an image.

OUTPUT FORMAT:
First think through the 3 questions briefly (1-2 lines), then the final prompt on a new
line starting with PROMPT:, then the alt on a new line starting with ALT:
Example:
1. This heading is about fraud detection in corporate accounting — showing how fake invoices get caught
2. A forensic accountant examining suspicious paperwork, red flags highlighted, calculator and audit reports on desk
3. Close-up over the shoulder shot showing the hands and documents in detail
PROMPT: close-up over shoulder shot of forensic accountant examining suspicious invoices with red flags, calculator and audit reports on desk, natural office lighting, shallow depth of field, muted color palette"""

    alt_lang = _language_name(language)
    user_prompt = f"""Heading: "{_inert(title)}"
Article topic: "{_inert(keyword)}"
Alt text language: {alt_lang}

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
                    # 300 was sized for reasoning + PROMPT alone. ALT is emitted last, so
                    # the old budget would have truncated exactly the new field.
                    "max_tokens": 500,
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

                # ALT: is split off FIRST. It comes after PROMPT: in the reply, so
                # slicing on PROMPT: alone would swallow the alt sentence into the image
                # prompt and ask the generator to draw it.
                alt = ""
                alt_idx = raw.upper().find("ALT:")
                if alt_idx >= 0:
                    alt = raw[alt_idx + len("ALT:"):].strip().strip('"').strip("'")
                    alt = _safe_alt(alt.split("\n")[0])
                    prompt_part = raw[:alt_idx]
                else:
                    prompt_part = raw

                # Extract prompt after PROMPT: delimiter
                prompt_marker = "PROMPT:"
                marker_idx = prompt_part.upper().find(prompt_marker)
                if marker_idx >= 0:
                    enriched = prompt_part[marker_idx + len(prompt_marker):].strip().strip('"').strip("'")
                else:
                    # Fallback: use the last non-empty line if no PROMPT: found
                    lines = [l.strip() for l in prompt_part.split('\n') if l.strip()]
                    enriched = lines[-1] if lines else prompt_part
                    enriched = enriched.strip('"').strip("'")

                print(f"[image] DeepSeek raw response ({len(raw)} chars): {raw[:200]}...")
                print(f"[image] DeepSeek enriched prompt: {enriched[:150]}...")
                print(f"[image] DeepSeek alt: {alt[:120]}")
                return enriched, alt
            else:
                print(f"[image] DeepSeek enrichment failed (HTTP {resp.status_code}): {resp.text[:200]}")
                return "", ""
    except Exception as e:
        print(f"[image] DeepSeek enrichment error: {e}")
        return "", ""


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


async def generate_article_image(
    keyword: str,
    article_title: str,
    style: str = "professional",
    language: str = "pl",
) -> dict:
    """
    Generuje obraz przez Pollinations.ai (Flux Schnell).
    1. DeepSeek wzbogaca heading w szczegółowy prompt (jeśli dostępny klucz API)
    2. Pollinations generuje obraz
    Zwraca dict z url (data URI base64), alt, width, height, source.
    """
    # Step 1: Try AI prompt enrichment
    enriched, ai_alt = await _enrich_prompt_with_ai(keyword, article_title, language)
    if enriched:
        # Prepend quality/style keywords to the enriched prompt
        prompt = f"{enriched}, cinematic 16:9 widescreen composition, 4K, ultra high resolution, professional editorial photography, no text, no watermarks"
    else:
        prompt = _build_prompt(keyword, article_title, style)

    # The model has just described this exact scene, so it is the only thing that knows
    # what the alt should say. "{heading} - {keyword}" described no image at all — it was
    # the same two fields every time, useful to neither a screen reader nor Google Images.
    alt_text = ai_alt or _surfer_style_alt(article_title, keyword, language)

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
    enriched, ai_alt = await _enrich_prompt_with_ai(keyword, article_title, language)
    if enriched:
        prompt = (
            f"{enriched}, cinematic 16:9 widescreen composition, 4K, ultra high resolution, "
            f"professional editorial photography, no text, no watermarks"
        )
    else:
        prompt = _build_prompt(keyword, article_title, style)

    # _surfer_style_alt is the fallback now, not the answer: it is one sentence template
    # with the heading slotted in, so every image on the page got the same alt.
    alt_text = ai_alt or _surfer_style_alt(article_title, keyword, language)
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
