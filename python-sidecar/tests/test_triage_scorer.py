# python-sidecar/tests/test_triage_scorer.py
from pipeline.stages.domain.triage_scorer import score_triage, OPTIMIZE_THRESHOLD


def test_strong_post_scores_high():
    signals = {
        "word_count": 1800, "title_length": 52, "description_length": 150,
        "heading_count": 12, "paragraph_count": 22, "image_alt_ratio": 1.0,
        "internal_links": 8,
    }
    assert score_triage(signals) >= 80


def test_thin_post_scores_low_enough_to_flag():
    signals = {
        "word_count": 180, "title_length": 12, "description_length": 0,
        "heading_count": 1, "paragraph_count": 2, "image_alt_ratio": 0.0,
        "internal_links": 0,
    }
    assert score_triage(signals) < OPTIMIZE_THRESHOLD


def test_score_is_clamped_0_100():
    assert 0 <= score_triage({}) <= 100
    assert score_triage({"word_count": 5000, "title_length": 55, "description_length": 160,
                         "heading_count": 20, "paragraph_count": 40, "image_alt_ratio": 1.0,
                         "internal_links": 20}) <= 100
