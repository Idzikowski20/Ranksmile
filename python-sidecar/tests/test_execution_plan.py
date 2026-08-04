"""Execution Plan Write Engine helpers — no outline invent when plan present."""
from pipeline.article_pipeline import (
    _format_execution_plan,
    _plan_conformity_ok,
    _planned_h2_headings,
)


SAMPLE_PLAN = {
    "plan_hash": "abc123",
    "title": "Jak pozycjonować stronę",
    "narrative": "step_by_step",
    "quick_answer": "Zacznij od Search Console i SSL — pierwsze efekty w tygodnie.",
    "article_budget": {"words": 3600},
    "reader": {"persona": "beginner", "goal": "rank", "tone": "practical"},
    "sections": [
        {
            "heading": "Quick Answer",
            "objective": "Action first",
            "priority": "critical",
            "expected_words": 200,
            "must_answer": ["Jak zacząć?"],
            "questions": ["Jak zacząć?"],
            "claims": [{"statement": "SSL jest wymagany", "sources": []}],
            "blocks": ["steps"],
            "evidence": [],
        },
        {
            "heading": "Quick Wins",
            "objective": "Fast wins",
            "priority": "high",
            "expected_words": 400,
            "must_answer": [],
            "questions": [],
            "claims": [],
            "blocks": ["checklist"],
            "evidence": [],
        },
        {
            "heading": "FAQ",
            "objective": "Answer PAA",
            "priority": "medium",
            "expected_words": 300,
            "must_answer": ["Ile trwa?"],
            "questions": ["Ile trwa?"],
            "claims": [],
            "blocks": ["faq"],
            "evidence": [],
        },
    ],
}


def test_format_execution_plan_includes_sections_and_quick_answer():
    text = _format_execution_plan(SAMPLE_PLAN)
    assert "plan_hash: abc123" in text
    assert "Quick Answer" in text
    assert "Quick Wins" in text
    assert "SSL jest wymagany" in text
    assert "Zacznij od Search Console" in text


def test_planned_h2_headings():
    assert _planned_h2_headings(SAMPLE_PLAN) == ["Quick Answer", "Quick Wins", "FAQ"]


def test_plan_conformity_ok_when_h2_match():
    html = """
    <h1>Jak pozycjonować stronę</h1>
    <p>Lead</p>
    <h2>Quick Answer</h2><p>x</p>
    <h2>Quick Wins</h2><p>y</p>
    <h2>FAQ</h2><p>z</p>
    """
    assert _plan_conformity_ok(html, SAMPLE_PLAN) is True


def test_plan_conformity_fails_on_invented_outline():
    html = """
    <h1>x</h1>
    <h2>Czym jest SEO</h2>
    <h2>Historia Google</h2>
    <h2>Encylopedia</h2>
    """
    assert _plan_conformity_ok(html, SAMPLE_PLAN) is False
