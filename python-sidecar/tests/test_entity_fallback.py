"""No-LLM path builds guidelines from entities, not TF-IDF shingles."""
import asyncio
import pytest

from analyzers.semantic_terms import extract_semantic_terms


@pytest.fixture(autouse=True)
def _no_llm_keys(monkeypatch):
    """These tests exercise the deterministic fallback; a real OPENROUTER key in the
    developer's environment must not flip them onto the network path."""
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)


TEXTS = [
    "Kodeks Karny przewiduje kary za szantaż. Zgłoszenie na Policję wymaga dowodów. "
    "Kodeks Karny opisuje groźby bezprawne." + " wypelniacz" * 250,
    "Policja przyjmuje zawiadomienie o przestępstwie. Kodeks Karny art. 191 dotyczy zmuszania. "
    "Prokuratura Rejonowa prowadzi sprawę." + " wypelniacz" * 250,
    "Zgłoś sprawę na Policję. Kodeks Karny reguluje odpowiedzialność za szantaż." + " tekst" * 250,
]


def test_entities_lead_the_no_llm_fallback():
    terms = asyncio.run(extract_semantic_terms("szantaż", TEXTS, ""))  # no deepseek key
    names = {t["term"].lower() for t in terms}
    # Multi-page capitalized entities survive; each carries a real doc_freq.
    assert any("kodeks karny" in n for n in names)
    entity_rows = [t for t in terms if t.get("type") == "entity"]
    assert entity_rows, "entity rows expected on the fallback path"
    assert all(t["doc_freq"] >= 2 for t in entity_rows)
