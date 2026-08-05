"""
Article Pipeline — wieloetapowe generowanie artykułu SEO.
Używa OpenRouter (OpenAI-compatible chat completions):
  base_url = https://openrouter.ai/api/v1
  model    = openai/gpt-5.6-luna
"""
import json
import os
import re
from openai import AsyncOpenAI


_client: AsyncOpenAI | None = None

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
MODEL = "openai/gpt-5.6-luna"


def get_openrouter_api_key() -> str:
    return (os.getenv("OPENROUTER_API_KEY") or "").strip()


def get_client() -> AsyncOpenAI:
    global _client
    key = get_openrouter_api_key()
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY missing")
    if _client is None:
        _client = AsyncOpenAI(
            api_key=key,
            base_url=OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": (os.getenv("NEXT_PUBLIC_APP_URL") or "https://ranksmile.pl").strip(),
                "X-Title": "Ranksmile",
            },
        )
    return _client


SYSTEM_PROMPT = """Jesteś ekspertem SEO i copywriterem. Tworzysz artykuły SEO wysokiej jakości,
które rankują na pierwszej stronie Google. Artykuły muszą być:
- Bogate w informacje, konkretne, oparte na faktach
- Zoptymalizowane pod keyword (naturalne wplecenie, nie keyword stuffing)
- Dobrze ustrukturyzowane: H1, H2, H3, paragrafy, listy
- Napisane z podanym tonem (professional/casual/neutral)
- W podanym języku
Zwracaj TYLKO HTML artykułu (bez DOCTYPE, body, head — czysty HTML artykułu)."""


async def _chat(prompt: str, max_tokens: int = 4000, *, system: str | None = SYSTEM_PROMPT) -> str:
    if not get_openrouter_api_key():
        print("[generate] OPENROUTER_API_KEY missing — skipping chat")
        return ""
    client = get_client()
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    try:
        response = await client.chat.completions.create(
            model=MODEL,
            max_tokens=max_tokens,
            messages=messages,
            extra_body={"reasoning": {"effort": "medium"}},
        )
    except Exception as exc:
        print(f"[generate] OpenRouter chat failed: {type(exc).__name__}: {exc}")
        return ""

    choice = response.choices[0] if response.choices else None
    content = ((choice.message.content if choice and choice.message else None) or "").strip()
    if not content:
        print("[generate] _chat returned empty content")
    return content


def _strip_code_fences(html: str) -> str:
    final_html = (html or "").strip()
    for prefix in ("```html", "```"):
        if final_html.startswith(prefix):
            final_html = final_html[len(prefix):]
    if final_html.endswith("```"):
        final_html = final_html[:-3]
    return final_html.strip()


def _is_usable_article(html: str) -> bool:
    plain = re.sub(r"<[^>]+>", " ", html or "")
    plain = re.sub(r"\s+", " ", plain).strip()
    return len(plain) >= 80


def _format_execution_plan(plan: dict) -> str:
    """Serialize Article Execution Plan for the Write Engine prompt (executor only)."""
    sections = plan.get("sections") or []
    lines: list[str] = [
        f"plan_hash: {plan.get('plan_hash', '')}",
        f"title/H1: {plan.get('title', '')}",
        f"narrative: {plan.get('narrative', '')}",
        f"quick_answer (embed as opening, do not rewrite structure): {plan.get('quick_answer', '')}",
        f"article_budget.words: {(plan.get('article_budget') or {}).get('words', '')}",
        f"reader: {json.dumps(plan.get('reader') or {}, ensure_ascii=False)}",
        "",
        "SECTIONS (execute exactly — do not invent/reorder H2):",
    ]
    for i, s in enumerate(sections, 1):
        claims = s.get("claims") or []
        claim_txt = "; ".join(
            (c.get("statement") if isinstance(c, dict) else str(c)) for c in claims[:8]
        )
        lines.append(
            f"{i}. H2: {s.get('heading')}\n"
            f"   objective: {s.get('objective')}\n"
            f"   priority: {s.get('priority')} | words≈{s.get('expected_words')}\n"
            f"   must_answer: {s.get('must_answer') or []}\n"
            f"   questions: {s.get('questions') or []}\n"
            f"   claims: {claim_txt}\n"
            f"   blocks: {s.get('blocks') or []}\n"
            f"   evidence: {s.get('evidence') or []}"
        )
    return "\n".join(lines)


def _planned_h2_headings(plan: dict) -> list[str]:
    return [
        str(s.get("heading") or "").strip()
        for s in (plan.get("sections") or [])
        if str(s.get("heading") or "").strip()
    ]


def _plan_conformity_ok(html: str, plan: dict) -> bool:
    """Post-write: output H2 set should mostly match Execution Plan (exact normalized titles)."""
    planned = [h.lower() for h in _planned_h2_headings(plan)]
    if not planned:
        return True
    h2s = [
        re.sub(r"<[^>]+>", "", m).strip().lower()
        for m in re.findall(r"<h2[^>]*>([\s\S]*?)</h2>", html or "", flags=re.I)
    ]
    if not h2s:
        return False
    covered = sum(1 for p in planned if p in h2s)
    return (covered / len(planned)) >= 0.7


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
    execution_plan: dict | None = None,
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

    plan = execution_plan if isinstance(execution_plan, dict) and execution_plan.get("sections") else None
    plan_words = int(
        ((plan or {}).get("article_budget") or {}).get("words") or target_words or 2200
    )

    if plan:
        # === Planner First: skip outline LLM — execute immutable Execution Plan ===
        plan_block = _format_execution_plan(plan)
        print(
            f"[generate] Execution Plan mode plan_hash={plan.get('plan_hash')} "
            f"sections={len(plan.get('sections') or [])}"
        )
        article_html = await _chat(f"""Jesteś Write Engine — EGZEKUTOR Article Execution Plan.
NIE wymyślaj outline, H2, narracji ani kolejności sekcji. Realizuj plan dokładnie.

Keyword: "{keyword}"
Język: {language}
Target słów: ~{plan_words}
{tone_directive}

ARTICLE EXECUTION PLAN:
{plan_block}

Kontekst strony (nie zmienia struktury planu):
{site_info}

NLP Terms (wpleć naturalnie, bez stuffingu): {terms_str}{brand_block}{instr_block}

WYMAGANIA:
- Zacznij od <h1> = title z planu (lub blisko)
- Natychmiast po H1 wstaw Quick Answer z planu jako 1–2 <p> (action-first)
- Dla KAŻDEJ sekcji z planu: dokładnie jedno <h2> z heading z planu, w tej kolejności
- Pokryj must_answer, claims i blocks z planu; nie dodawaj obcych H2
- Paragrafy 3-5 zdań; listy gdzie blocks wymagają
{ext_req}
- TYLKO HTML (h1,h2,h3,p,ul,ol,strong,em,a,table) — bez <html>,<body>,<head>""", max_tokens=8000)

        article_html = _strip_code_fences(article_html)

        if not _is_usable_article(article_html):
            print("[generate] Execution Plan write empty — retrying once")
            article_html = _strip_code_fences(await _chat(
                f"""Execute this Article Execution Plan as full HTML article.
Keyword: "{keyword}". Language: {language}. ~{plan_words} words.
{tone_directive}
PLAN:
{plan_block[:6000]}
Start with <h1>. Use ONLY planned H2 headings in order. Only article HTML.""",
                max_tokens=8000,
            ))

        # Intra-section review only — never change H2/outline/narrative.
        reviewed = _strip_code_fences(await _chat(f"""Zreviewuj STYL wewnątrz sekcji artykułu SEO dla keyword "{keyword}".
DOZWOLONE: popraw przejścia między akapitami, powtórzenia, keyword stuffing, klarowność zdań.
ZABRONIONE: zmieniać, dodawać, usuwać lub przestawiać H2; zmieniać narrację/outline; wymyślać nowe sekcje.

Zwróć POPRAWIONY HTML (tylko HTML):

{article_html}""", max_tokens=8000))

        if _is_usable_article(reviewed) and _plan_conformity_ok(reviewed, plan):
            return reviewed
        if _is_usable_article(reviewed) and not _plan_conformity_ok(reviewed, plan):
            print("[generate] Review broke plan conformity — keeping Phase write")

        if _is_usable_article(article_html) and _plan_conformity_ok(article_html, plan):
            return article_html

        if _is_usable_article(article_html):
            print("[generate] Phase write H2 low conformity — retrying once")
            article_html = _strip_code_fences(await _chat(
                f"""Execute this Article Execution Plan as full HTML article.
Keyword: "{keyword}". Language: {language}. ~{plan_words} words.
{tone_directive}
PLAN:
{plan_block[:6000]}
Start with <h1>. Use ONLY the planned H2 headings EXACTLY as written and in order. Do not invent sections. Only article HTML.""",
                max_tokens=8000,
            ))
            if _is_usable_article(article_html) and _plan_conformity_ok(article_html, plan):
                return article_html
            print("[generate] Execution Plan conformity failed after retry — rejecting output")
            return ""

        print("[generate] Execution Plan pipeline produced no usable HTML")
        return ""

    # === Legacy fallback (no Execution Plan): Faza 1 Outline ===
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

    article_html = _strip_code_fences(article_html)

    # Retry once if the model returned thinking-only / empty HTML.
    if not _is_usable_article(article_html):
        print("[generate] Phase 2 empty/unusable — retrying article generation once")
        article_html = _strip_code_fences(await _chat(f"""Napisz PEŁNY artykuł SEO w HTML na keyword "{keyword}".
Język: {language}. Target: ~{target_words} słów.
Typ: {type_guide}
{tone_directive}
NLP: {terms_str}{brand_block}{instr_block}
Outline (jeśli jest): {outline[:3000] if outline else "(brak)"}
Zacznij od <h1>. Tylko HTML artykułu.""", max_tokens=8000))

    # === Faza 3: SEO Review (never replace a good draft with an empty review) ===
    reviewed = _strip_code_fences(await _chat(f"""Zreviewuj i popraw artykuł SEO dla keyword "{keyword}":
- Keyword w H1, pierwszym paragrafie i kilku H2
- NLP terms naturalnie wplecione: {terms_str[:200]}
- Min. {target_words} słów
- Usuń keyword stuffing

Zwróć POPRAWIONY HTML (tylko HTML, bez komentarzy):

{article_html}""", max_tokens=8000))

    if _is_usable_article(reviewed):
        return reviewed
    if _is_usable_article(article_html):
        print("[generate] Phase 3 empty — keeping Phase 2 article")
        return article_html

    print("[generate] Pipeline produced no usable HTML")
    return ""


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
        if not get_openrouter_api_key():
            print("[internal-links] No OPENROUTER_API_KEY — skipping")
            return []

        raw = (
            await _chat(
                prompt,
                max_tokens=1024,
                system="You suggest internal links. Reply with JSON only — no markdown fences.",
            )
        ).strip()

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
