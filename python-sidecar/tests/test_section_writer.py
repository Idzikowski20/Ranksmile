import asyncio
from dataclasses import FrozenInstanceError

from pipeline.section_writer import ParagraphResult, write_paragraph


async def _markdown(_: str) -> str:
    return "Audyt SEO wskazuje priorytety. Audyt pokazuje kolejne kroki."


PARAGRAPH = {
    "id": "p1",
    "section_id": "s1",
    "goal": "intro",
    "expected_words": 50,
    "claims": [{"claim_id": "c1"}],
    "facts": [{"fact_id": "f1"}],
    "entities": [{"entity_id": "e1"}],
    "questions": [{"question_id": "q1"}],
    "keywords": [{"term": "audyt", "required": True}],
}


def test_write_paragraph_returns_frozen_markdown_result():
    result = asyncio.run(write_paragraph(PARAGRAPH, _markdown))

    assert isinstance(result, ParagraphResult)
    assert result.paragraph_id == "p1"
    assert result.section_id == "s1"
    assert result.markdown == "Audyt SEO wskazuje priorytety. Audyt pokazuje kolejne kroki."
    assert result.used_claim_ids == ("c1",)
    assert result.used_fact_ids == ("f1",)
    assert result.used_entity_ids == ("e1",)
    assert result.used_terms == (("audyt", 2),)
    assert result.coverage.questions_answered == ("q1",)
    assert result.coverage.questions_missed == ()
    assert 0 <= result.confidence <= 1

    try:
        result.markdown = "mutated"  # type: ignore[misc]
    except FrozenInstanceError:
        pass
    else:
        raise AssertionError("ParagraphResult must be immutable")
