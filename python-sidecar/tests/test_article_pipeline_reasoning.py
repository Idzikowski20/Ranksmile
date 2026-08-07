import os

from pipeline.article_pipeline import _reasoning_body, _reasoning_effort


def test_reasoning_is_off_unless_asked_for(monkeypatch):
    """
    Hardcoded `reasoning: {effort: medium}` starved every writer call: reasoning tokens
    count against max_tokens, and at the paragraph writer's 1200 the model spent the whole
    budget thinking and returned empty content every time.
    """
    monkeypatch.delenv("OPENROUTER_REASONING_EFFORT", raising=False)

    assert _reasoning_effort() == ""
    assert _reasoning_body() == {}


def test_reasoning_can_be_turned_back_on(monkeypatch):
    monkeypatch.setenv("OPENROUTER_REASONING_EFFORT", "high")

    assert _reasoning_body() == {"extra_body": {"reasoning": {"effort": "high"}}}


def test_blank_env_value_counts_as_off(monkeypatch):
    monkeypatch.setenv("OPENROUTER_REASONING_EFFORT", "   ")

    assert _reasoning_body() == {}
