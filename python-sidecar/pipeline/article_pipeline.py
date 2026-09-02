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
from pipeline.compiled_runtime import run_compiled_write_plan
from pipeline.internal_links import format_internal_link_block


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


# `reasoning: {effort: minimal}` — the OPPOSITE of the old bug. A hardcoded
# `effort: medium` once burned the whole 1200-token budget on thinking and shipped
# empty paragraphs; removing the parameter entirely let the model fall back to its
# DEFAULT reasoning effort, which on gpt-5-class models burns the budget just the
# same (3600/3600 reasoning tokens, zero content). Prose paragraphs need no chain
# of thought: pin effort to minimal so the budget goes to the article.
_REASONING_MINIMAL = {"reasoning": {"effort": "minimal", "exclude": True}}


async def _chat(
    prompt: str,
    max_tokens: int = 4000,
    *,
    system: str | None = SYSTEM_PROMPT,
    _retry: bool = True,
) -> str:
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
            extra_body=_REASONING_MINIMAL,
        )
    except Exception as exc:
        print(f"[generate] OpenRouter chat failed: {type(exc).__name__}: {exc}")
        return ""

    choice = response.choices[0] if response.choices else None
    content = ((choice.message.content if choice and choice.message else None) or "").strip()
    # Reasoning burn: the model spends the whole budget thinking and emits nothing —
    # finish_reason=length with a fully used completion budget and empty content. One
    # retry with 3× headroom recovers the paragraph; 15/36 paragraphs shipped empty
    # without it and the article was headings plus stock images.
    if (
        not content
        and _retry
        and getattr(choice, "finish_reason", None) == "length"
    ):
        bumped = max(6000, max_tokens * 3)
        # Diagnosis breadcrumb: if the burn is reasoning, the response carries it.
        reasoning = getattr(choice.message, "reasoning", None) if choice and choice.message else None
        if reasoning:
            print(f"[generate] budget went to reasoning ({len(str(reasoning))} chars) despite effort=minimal")
        print(f"[generate] retrying empty length-capped completion with max_tokens={bumped}")
        return await _chat(prompt, bumped, system=system, _retry=False)
    if not content:
        # "empty content" alone is not a diagnosis — it looks identical whether the model
        # refused, returned nothing, or spent the whole budget before emitting a token.
        # finish_reason plus the usage split tells them apart at a glance.
        usage = getattr(response, "usage", None)
        print(
            "[generate] _chat returned empty content"
            f" (finish_reason={getattr(choice, 'finish_reason', None)},"
            f" max_tokens={max_tokens},"
            f" completion_tokens={getattr(usage, 'completion_tokens', None)})"
        )
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
    brand_name: str = "",
    voice_tone: str = "",
    template_reference: str = "",
    execution_plan: dict | None = None,
    compiled_write_plan: dict | None = None,
    existing_articles: list[dict] | None = None,
    internal_links: bool = True,
    on_status=None,
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
    # Internal links are written INTO the body (allowlist enforced after render),
    # not appended as post-hoc suggestions.
    link_articles = existing_articles or []
    links_block = (
        format_internal_link_block(link_articles, language) if internal_links else ""
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
    # Voice (writing-style sample) + template (structure/format reference) travel with
    # every paragraph in the compiled path — the writer is stateless, so without this the
    # selected Custom Voice / Content Template never reached the model that wrote the body.
    voice_block = (
        f"\n\nGŁOS MARKI (naśladuj ton i styl, nie kopiuj treści):\n{voice_tone.strip()[:1500]}"
        if voice_tone.strip() else ""
    )
    template_block = (
        f"\n\nWZORZEC TREŚCI (naśladuj strukturę i format, nie kopiuj treści):\n{template_reference.strip()[:1500]}"
        if template_reference.strip() else ""
    )
    style_block = f"{voice_block}{template_block}"

    site_info = (
        f"Strona: {site_context.get('url', '')}\n"
        f"Tytuł: {site_context.get('title', '')}\n"
        f"Ton: {site_context.get('tone', tone)}\n"
    )

    plan = execution_plan if isinstance(execution_plan, dict) and execution_plan.get("sections") else None
    plan_words = int(
        ((plan or {}).get("article_budget") or {}).get("words") or target_words or 2200
    )

    if compiled_write_plan is not None:
        if not isinstance(compiled_write_plan, dict):
            raise ValueError("compiled_write_plan must be an object")

        # Short list per paragraph — the full block would be re-sent for every paragraph.
        # quota="0–1": write_markdown runs once per paragraph, so the article-level
        # "2–5" quota would ask for 2–5 links in EACH paragraph, compounding well past
        # the intended per-article total as the plan grows more paragraphs.
        paragraph_links_block = (
            format_internal_link_block(
                link_articles, language, limit=12,
                # Link generously. "dokładnie 1, jeśli DOKŁADNIE pasuje" shipped 3 links
                # against the reference's 12: most topical paragraphs (mechanizmy, techniki)
                # never name a service-page slug, so they linked nothing. The reference
                # links on a RELATED concept — "uporczywe nękanie" -> /stalking-nekanie/,
                # "przemoc psychiczna" -> /przemoc-psychiczna/ — not an exact match.
                # enforce_internal_links still unwraps anything off-list, so being liberal
                # here is safe.
                quota="1 (wyjątkowo 2), gdy akapit dotyka tematu powiązanego z pozycją z listy — linkuj chętnie na luźno powiązane pojęcia, nie tylko przy dokładnym dopasowaniu (jeśli nic nie pasuje, 0)",
            )
            if internal_links else ""
        )
        link_note = (
            "\n\nJeśli akapit zawiera markdown link `[tekst](url)`, zachowaj go dokładnie "
            "— nie usuwaj i nie wymyślaj nowych adresów."
            if language.startswith("pl") else
            "\n\nIf the paragraph contains a markdown link `[text](url)`, preserve it "
            "exactly — don't drop it or invent new ones."
        ) if internal_links else ""
        written = 0

        async def write_markdown(prompt: str) -> str:
            nonlocal written
            written += 1
            if on_status:
                # Status feedback must never break the write.
                try:
                    # Paragraphs, not sections: write_markdown runs once per paragraph
                    # plan, so a 12-section outline reports well past 12.
                    await on_status(f"Writing paragraph {written}…")
                except Exception as exc:
                    print(f"[generate] status callback failed: {exc}")
            # Brand context travels with every paragraph — the writer is stateless, and
            # without it no paragraph could name the agency the brief's "nawiąż do nas"
            # bullets refer to.
            name_line = (
                f"BRAND NAME: {brand_name.strip()} - when this paragraph references us, "
                "use this exact name.\n"
                if brand_name.strip() else ""
            )
            paragraph_brand = (
                "\n\nBRAND (use as context where the plan asks to reference us; "
                f"never invent facts):\n{name_line}{brand_knowledge.strip()[:1200]}"
                if brand_knowledge.strip() else ""
            )
            return await _chat(
                f"Keyword: {keyword}\nLanguage: {language}\nTone: {tone}"
                f"{paragraph_brand}{style_block}\n\n"
                f"{prompt}{paragraph_links_block}",
                max_tokens=1200,
                system="Write SEO content as Markdown only. Never emit HTML.",
            )

        async def rewrite_markdown(markdown: str) -> str:
            return await _chat(
                f"Rewrite this Markdown block for clarity and factual precision. "
                f"Preserve its Markdown structure exactly — a bullet list stays a bullet "
                f"list with its bold label, a table stays a table, a paragraph stays a "
                f"paragraph. Markdown only.{link_note}\n\n{markdown}",
                max_tokens=1200,
                system="You are an editorial judge. Return only rewritten Markdown.",
            )

        if on_status:
            try:
                await on_status("Reading competitor outlines…")
            except Exception as exc:
                print(f"[generate] status callback failed: {exc}")

        compiled = await run_compiled_write_plan(
            compiled_write_plan, write_markdown, rewrite_markdown, external_links,
        )
        if not compiled.html:
            raise RuntimeError("compiled_write_plan produced empty HTML")
        return ensure_brand_mention(compiled.html, brand_name, language)

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

NLP Terms (wpleć naturalnie, bez stuffingu): {terms_str}{brand_block}{instr_block}{links_block}

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
Start with <h1>. Use ONLY planned H2 headings in order. Only article HTML.{links_block}""",
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
Start with <h1>. Use ONLY the planned H2 headings EXACTLY as written and in order. Do not invent sections. Only article HTML.{links_block}""",
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

NLP Terms (wpleć naturalnie): {terms_str}{brand_block}{instr_block}{links_block}

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


def ensure_brand_mention(html: str, brand_name: str, language: str = "pl") -> str:
    """
    Guarantee the article names the brand at least once.

    The closing-paragraph instruction is followed ~60% of the time - 3 of 7 audited
    articles ended with a correct call to action that never said who was making it.
    Deterministic, like the FAQ-shape fix: when the name is absent, one CTA sentence
    is appended to the last paragraph. Prose the model wrote is never edited.
    """
    name = (brand_name or "").strip()
    if not name or name.lower() in html.lower():
        return html
    if str(language or "pl").lower().startswith("pl"):
        cta = f" Jesli potrzebujesz poufnej pomocy w takiej sprawie, skontaktuj sie z {name}."
    else:
        cta = f" If you need confidential help with a situation like this, contact {name}."
    idx = html.rfind("</p>")
    if idx < 0:
        return html + "<p>" + cta.strip() + "</p>"
    print(f"[generate] brand name missing from article - appending closing CTA for {name}")
    return html[:idx] + cta + html[idx:]


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
  "brand_knowledge": "Business Type\\n<...>\\n\\nIndustry\\n<...>\\n\\nProducts/Services description\\n<...>\\n\\nCustomer profile\\n<...>\\n\\nCompetitors\\n<...>\\n\\nTopics to cover\\n<...>\\n\\nExample cases (anonymized)\\n<2-3 zanonimizowane przykłady spraw/realizacji ze strony — sytuacja, działanie, wynik; tylko jeśli treść strony je opisuje, nigdy nie wymyślaj>"
}}
Bądź konkretny i oparty na treści strony. Sekcję "Example cases" wypełnij tylko faktami
ze strony (case studies, opisy realizacji, referencje) — writer użyje ich jako
przykładów "z naszej praktyki" w artykułach."""
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


def _parse_link_suggestions(raw: str) -> list[dict]:
    """Parse the link-suggestion JSON, salvaging a truncated array.

    The model returns a JSON array of {anchorText, url, articleTitle}. When the response
    is cut off mid-array (token budget), the closing bracket is missing and a whole-array
    parse yields nothing — so fall back to collecting every complete {...} object that
    still parsed, keeping the links the model did finish.
    """
    m = re.search(r"\[[\s\S]*\]", raw)
    if m:
        try:
            arr = json.loads(m.group(0))
            if isinstance(arr, list):
                return [s for s in arr if isinstance(s, dict) and s.get("anchorText") and s.get("url")]
        except Exception:
            pass
    out: list[dict] = []
    for obj in re.findall(r"\{[^{}]*\}", raw):
        try:
            s = json.loads(obj)
        except Exception:
            continue
        if isinstance(s, dict) and s.get("anchorText") and s.get("url"):
            out.append(s)
    return out


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

    # The whole article, not the first third: the reference article carries 12 internal
    # links spread across every section, and an 8k slice meant anchors in the second half
    # of a ~25k article could never be suggested — runs stalled at 2 links.
    if len(plain) > 24000:
        plain = plain[:24000] + "…"

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
- Spread the links across the WHOLE article, not just the opening sections
- Aim for 12-16 suggestions; fewer only when the article genuinely lacks anchors

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

        # 4096, not 2048: a rich link pool makes the model emit 12-16 suggestions, and the
        # smaller budget truncated the JSON array mid-object — the closing ] never arrived,
        # so the array parse found nothing and the run shipped 0 links.
        raw = (
            await _chat(
                prompt,
                max_tokens=4096,
                system="You suggest internal links. Reply with JSON only — no markdown fences.",
            )
        ).strip()

        suggestions = _parse_link_suggestions(raw)
        print(f"[internal-links] Found {len(suggestions)} suggestions")
        return suggestions

    except Exception as e:
        print(f"[internal-links] Error: {e}")
        return []
