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


def test_an_unrecognised_value_is_ignored_rather_than_sent(monkeypatch):
    """
    A typo used to be forwarded verbatim; the provider rejected the request and `_chat`'s
    catch-all turned that into the same empty content this guard exists to prevent.
    """
    monkeypatch.setenv("OPENROUTER_REASONING_EFFORT", "maximum")

    assert _reasoning_body() == {}


def test_explicit_off_values_are_not_reported_as_typos(monkeypatch, capsys):
    monkeypatch.setenv("OPENROUTER_REASONING_EFFORT", "off")

    assert _reasoning_body() == {}
    assert "ignoring" not in capsys.readouterr().out
