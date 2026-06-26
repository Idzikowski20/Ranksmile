"""
Article Pipeline — wieloetapowe generowanie artykułu SEO.
Używa DeepSeek API z Anthropic-compatible endpoint:
  base_url = https://api.deepseek.com/anthropic
  model    = deepseek-v4-flash
"""
import json
import os
import re
import anthropic
import httpx


_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(
            api_key=os.getenv("DEEPSEEK_API_KEY", ""),
            base_url="https://api.deepseek.com/anthropic",
        )
    return _client


MODEL = "deepseek-v4-flash"

SYSTEM_PROMPT = """Jesteś ekspertem SEO i copywriterem. Tworzysz artykuły SEO wysokiej jakości,
które rankują na pierwszej stronie Google. Artykuły muszą być:
- Bogate w informacje, konkretne, oparte na faktach
- Zoptymalizowane pod keyword (naturalne wplecenie, nie keyword stuffing)
- Dobrze ustrukturyzowane: H1, H2, H3, paragrafy, listy
- Napisane z podanym tonem (professional/casual/neutral)
- W podanym języku
Zwracaj TYLKO HTML artykułu (bez DOCTYPE, body, head — czysty HTML artykułu)."""


async def _chat(prompt: str, max_tokens: int = 4000) -> str:
    client = get_client()
    response = await client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    # DeepSeek may return ThinkingBlock(s) before the actual TextBlock
    for block in response.content:
        if block.type == "text":
            return block.text
    return ""


# Maps the wizard content-type to a structural directive for the prompt.
CONTENT_TYPE_GUIDE = {
    "blog": "artykuł blogowy (long-form), wyczerpująco omawiający temat",
    "landing": "strona landing page — przekonująca, sekcje korzyści, social proof, wyraźne CTA",
    "comparison": "artykuł porównawczy — zestawienia/sekcje porównujące opcje, plusy i minusy",
    "listicle": "artykuł w formie listy (listicle) — ponumerowane, konkretne punkty",
    "product": "strona produktowa e-commerce — opis, cechy, korzyści, specyfikacja, CTA",
    "category": "strona kategorii e-commerce — przegląd kategorii, podkategorie, przewodnik zakupowy",
    "service": "strona usługowa (local business) — opis usługi, proces, obszar działania, CTA",
    "llm": "treść pod LLM/AI Search — jasne definicje, sekcja FAQ, struktura łatwa do cytowania",
}


async def run_pipeline(
    site_context: dict,
    serp_data: dict,
    keyword: str,
    language: str = "pl",
    tone: str = "professional",
    target_words: int = 2200,
    content_type: str = "blog",
    instructions: str = "",
    external_links: bool = True,
    brand_knowledge: str = "",
    voice_tone: str = "",
) -> str:
    top_terms = [t["term"] for t in serp_data.get("terms", [])[:25]]
    terms_str = ", ".join(top_terms) if top_terms else "brak danych NLP"

    type_guide = CONTENT_TYPE_GUIDE.get(content_type, CONTENT_TYPE_GUIDE["blog"])
    instr_block = (
        f"\n\nDODATKOWE INSTRUKCJE UŻYTKOWNIKA (wysoki priorytet — zastosuj je):\n{instructions.strip()}"
        if instructions.strip() else ""
    )
    ext_req = (
        '- Wpleć 2-4 linki zewnętrzne <a href="..."> do wiarygodnych, autorytatywnych źródeł'
        if external_links else "- Nie dodawaj linków zewnętrznych"
    )
    brand_block = (
        f"\n\nWIEDZA O MARCE (użyj jako kontekst, nie kopiuj dosłownie):\n{brand_knowledge.strip()}"
        if brand_knowledge.strip() else ""
    )
    # Custom voice reference text overrides the generic tone.
    tone_directive = (
        f"Ton i styl: naśladuj poniższy wzorzec głosu marki —\n{voice_tone.strip()[:1500]}"
        if voice_tone.strip() else f"Ton: {tone}"
    )

    site_info = (
        f"Strona: {site_context.get('url', '')}\n"
        f"Tytuł: {site_context.get('title', '')}\n"
        f"Ton: {site_context.get('tone', tone)}\n"
    )

    # === Faza 1: Outline ===
    outline = await _chat(f"""Stwórz szczegółowy outline artykułu SEO na keyword: "{keyword}"

Typ treści: {type_guide}

Kontekst strony:
{site_info}

NLP Terms do pokrycia: {terms_str}
Target: ~{target_words} słów, {serp_data.get('headings_target', 15)} nagłówków H2/H3.
Język: {language}{brand_block}{instr_block}

Format:
## H2 tytuł
### H3 podsekcja (opis co zawrzeć)""", max_tokens=2000)

    # === Faza 2: Pełny artykuł ===
    article_html = await _chat(f"""Na podstawie poniższego outline stwórz PEŁNY artykuł SEO w HTML.

Keyword: "{keyword}"
Typ treści: {type_guide}
Język: {language}, Target słów: {target_words}
{tone_directive}

Outline:
{outline}

NLP Terms (wpleć naturalnie): {terms_str}{brand_block}{instr_block}

WYMAGANIA:
- Zacznij od <h1> z keyword w tytule
- Użyj H2 i H3 zgodnie z outline
- Pisz treść bogatą w informacje i konkretne przykłady
- Paragrafy 3-5 zdań, listy <ul>/<ol> gdzie sensowne
{ext_req}
- Zakończ podsumowaniem
- TYLKO HTML (h1,h2,h3,p,ul,ol,strong,em,a) — bez <html>,<body>,<head>""", max_tokens=8000)

    # === Faza 3: SEO Review ===
    final_html = await _chat(f"""Zreviewuj i popraw artykuł SEO dla keyword "{keyword}":
- Keyword w H1, pierwszym paragrafie i kilku H2
- NLP terms naturalnie wplecione: {terms_str[:200]}
- Min. {target_words} słów
- Usuń keyword stuffing

Zwróć POPRAWIONY HTML (tylko HTML, bez komentarzy):

{article_html}""", max_tokens=8000)

    # Oczyść z markdown code blocks
    final_html = final_html.strip()
    for prefix in ["```html", "```"]:
        if final_html.startswith(prefix):
            final_html = final_html[len(prefix):]
    if final_html.endswith("```"):
        final_html = final_html[:-3]

    return final_html.strip()


async def generate_brand_knowledge(url: str, title: str, description: str, page_text: str) -> dict:
    """Scrape-based Brand Knowledge draft: analyse a company page and produce the
    structured Brand Knowledge fields, in the page's language."""
    prompt = f"""Przeanalizuj treść strony firmy i wygeneruj zwięzłą "Brand Knowledge".

URL: {url}
Tytuł: {title}
Opis: {description}

Treść strony (fragment):
{page_text[:6000]}

Zwróć WYŁĄCZNIE JSON (bez markdown), pisany w języku strony:
{{
  "brand_name": "krótka nazwa marki/firmy",
  "brand_knowledge": "Business Type\\n<...>\\n\\nIndustry\\n<...>\\n\\nProducts/Services description\\n<...>\\n\\nCustomer profile\\n<...>\\n\\nCompetitors\\n<...>\\n\\nTopics to cover\\n<...>"
}}
Bądź konkretny i oparty na treści strony."""
    raw = (await _chat(prompt, max_tokens=1500)).strip()
    for p in ("```json", "```"):
        if raw.startswith(p):
            raw = raw[len(p):]
    if raw.endswith("```"):
        raw = raw[:-3]
    raw = raw.strip()
    try:
        match = re.search(r"\{[\s\S]*\}", raw)
        data = json.loads(match.group(0) if match else raw)
        return {
            "brand_name": str(data.get("brand_name", "")),
            "brand_knowledge": str(data.get("brand_knowledge", "")),
        }
    except Exception:
        return {"brand_name": "", "brand_knowledge": raw}


async def suggest_internal_links(
    article_html: str,
    site_url: str,
    existing_articles: list[dict] | None = None,
) -> list[dict]:
    """
    Znajduje naturalne miejsca na internal linki do istniejacych artykulow.
    Uzywa DeepSeek do dopasowania anchor textow w wygenerowanym artykule.
    """
    if not existing_articles:
        return []

    # Strip HTML to plain text for analysis
    plain = re.sub(r"<[^>]+>", " ", article_html)
    plain = re.sub(r"\s+", " ", plain).strip()

    # Limit to first ~8000 chars to keep prompt reasonable
    if len(plain) > 8000:
        plain = plain[:8000] + "…"

    # Build article list
    article_list = "\n".join(
        f'{i + 1}. Title: "{a["title"]}" | URL: {a["url"]}'
        for i, a in enumerate(existing_articles[:25])
    )

    prompt = f"""You are an SEO specialist. Find ALL natural internal linking opportunities in this article.

ARTICLE CONTENT:
{plain}

AVAILABLE INTERNAL LINKS (link to these articles):
{article_list}

TASK:
Find every phrase in the article content that would naturally serve as anchor text for one of the available articles above.
Rules:
- Match based on semantic relevance between the anchor phrase and the target article title/URL
- Each available article can appear at most ONCE as a suggestion
- Only suggest links where the anchor text appears VERBATIM in the article content
- Pick the most natural, contextually relevant phrase for each link
- Prefer longer, more specific phrases (3-7 words) over single words
- Maximum 8 suggestions total

OUTPUT FORMAT — JSON array only, no other text:
[
  {{
    "anchorText": "exact phrase from the article",
    "url": "url of the target article",
    "articleTitle": "title of the target article"
  }}
]

If no natural links found, return: []"""

    try:
        api_key = os.getenv("DEEPSEEK_API_KEY", "")
        if not api_key:
            print("[internal-links] No DEEPSEEK_API_KEY — skipping")
            return []

        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                json={
                    "model": "deepseek-chat",
                    "max_tokens": 1024,
                    "temperature": 0.1,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            r.raise_for_status()
            data = r.json()
            raw: str = data["choices"][0]["message"]["content"]

            # Extract JSON array
            json_match = re.search(r"\[[\s\S]*\]", raw)
            if not json_match:
                print(f"[internal-links] No JSON array in response: {raw[:200]}")
                return []

            suggestions = json.loads(json_match[0])
            print(f"[internal-links] Found {len(suggestions)} suggestions")
            return suggestions

    except Exception as e:
        print(f"[internal-links] Error: {e}")
        return []
