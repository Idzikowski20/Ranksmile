"""No-LLM rule-based content score for blog-post triage (P3d).

Mirrors the deduction philosophy of score_ranking._compute_rule_base, but uses
absolute on-page targets because triage has no SERP competitor context.
"""

OPTIMIZE_THRESHOLD = 70

WORDS_TARGET = 1200      # a healthy blog post
TITLE_MIN, TITLE_MAX = 30, 65
DESC_MIN = 70


def score_triage(signals: dict) -> int:
    """Map on-page signals to a 0-100 content score. Higher = healthier."""
    score = 80

    word_count = signals.get("word_count", 0)
    if word_count < WORDS_TARGET * 0.4:
        score -= 30
    elif word_count < WORDS_TARGET * 0.7:
        score -= 15

    title_len = signals.get("title_length", 0)
    if title_len < TITLE_MIN or title_len > TITLE_MAX:
        score -= 10

    if signals.get("description_length", 0) < DESC_MIN:
        score -= 8

    if signals.get("heading_count", 0) < 3:
        score -= 10

    if signals.get("paragraph_count", 0) < 4:
        score -= 5

    # image alt coverage: ratio 0..1 of images that have alt text
    alt_ratio = signals.get("image_alt_ratio", 1.0)
    if alt_ratio < 0.5:
        score -= 5

    if signals.get("internal_links", 0) < 2:
        score -= 5

    # reward depth a little so strong posts clear 80
    if word_count >= WORDS_TARGET and signals.get("heading_count", 0) >= 8:
        score += 8

    return max(0, min(100, score))
