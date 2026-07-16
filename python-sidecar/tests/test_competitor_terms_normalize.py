from analyzers.competitor_terms import normalize_text


def test_normalize_text_maps_l_stroke():
    assert normalize_text("działania") == "dzialania"
    assert normalize_text("przykłady") == "przyklady"
    assert "dzia ania" not in normalize_text("działania poniżej progu wojny")
    assert normalize_text("działania poniżej progu wojny") == "dzialania ponizej progu wojny"
