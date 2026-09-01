"""Voice + Content Template references must reach the paragraph writer.

Regression guard: voice_tone was passed into run_pipeline but the compiled write path
(the only live path) never threaded it into the paragraph prompt, so the selected
Custom Voice / Content Template silently never influenced the generated body.
"""
import asyncio

import pipeline.article_pipeline as ap


PLAN = {
    "title": "SEO guide",
    "keyword": "SEO",
    "graph": {"sources": [], "entities": [], "claims": [], "facts": [], "questions": []},
    "manifest": {"compiler_version": "1"},
    "knowledge_packs": [{"id": "s1", "heading": "Start", "paragraph_plan_ids": ["p1"]}],
    "paragraph_plans": [{
        "id": "p1", "section_id": "s1", "goal": "intro", "expected_words": 4,
        "claims": [], "facts": [], "entities": [], "questions": [],
        "keywords": [{"term": "SEO", "required": True}],
    }],
}

VOICE = "Piszemy krótko, rzeczowo, bez żargonu — jak rozmowa ze znajomym ekspertem."
TEMPLATE = "Sekcja: problem. Sekcja: rozwiązanie krok po kroku. Sekcja: podsumowanie i CTA."


def _run(voice: str, template: str) -> list[str]:
    seen: list[str] = []

    async def fake_chat(prompt, max_tokens=4000, *, system=None, _retry=True):
        seen.append(prompt)
        return "SEO wyznacza jasne priorytety."

    ap._chat = fake_chat  # type: ignore[assignment]
    asyncio.run(ap.run_pipeline(
        site_context={"url": "https://x.pl", "title": "X", "tone": "professional"},
        serp_data={"terms": [{"term": "SEO"}]},
        keyword="SEO",
        language="pl",
        voice_tone=voice,
        template_reference=template,
        compiled_write_plan=PLAN,
    ))
    return seen


def test_voice_and_template_reach_the_paragraph_prompt():
    prompts = _run(VOICE, TEMPLATE)
    body = " ".join(prompts)
    assert VOICE in body, "custom voice never reached the writer"
    assert TEMPLATE in body, "content template never reached the writer"


def test_no_style_blocks_when_none_selected():
    prompts = _run("", "")
    body = " ".join(prompts)
    assert "GŁOS MARKI" not in body
    assert "WZORZEC TREŚCI" not in body
