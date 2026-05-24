"""
Validation script — compares rule-base vs AI scores.
Run: python scripts/validate_scores.py
Tests:
  1. Score stability: re-analyze same article 3x, check variance <= 5 points
  2. Score range: thin content scores low (< 50), strong content scores high (> 70)
"""
import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from analyzers.ranking_scorer import predict_ranking


async def test_stability():
    """Re-analyze same inputs 3x, verify <=5 point variance."""
    print("\n=== Stability Test ===")
    site_context = {
        "meta": {"title": "Complete SEO Guide 2024", "title_length": 25, "description": "Full guide to SEO", "description_length": 60, "og_title": "", "og_description": "", "og_image": "", "canonical": ""},
        "content": {"word_count": 2500, "paragraph_count": 18},
        "headings": {"total": 14},
        "issues": [],
    }
    serp_data = {"words_target": 2200, "headings_target": 15, "paragraphs_target": 20}
    classify = {"page_type": "article", "is_thin": False, "eeat_score": 65, "content_originality_risk": "low", "freshness_score": 75}

    scores = []
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not deepseek_key:
        print("SKIP: No DEEPSEEK_API_KEY — cannot run stability test without AI")
        return

    for i in range(3):
        result = await predict_ranking("SEO guide", 75, site_context, serp_data, classify, deepseek_key)
        scores.append(result["ranking_score"])
        s = result["ranking_signals"]
        print(f"  Run {i+1}: {result['ranking_score']} (rule={s['rule_base']}, llm={s['llm_total']})")

    variance = max(scores) - min(scores)
    status = "PASS" if variance <= 5 else "FAIL"
    print(f"  Variance: {variance} points — {status} (threshold: <=5)")


async def test_score_range():
    """Test that low-quality inputs score low and high-quality score high."""
    print("\n=== Score Range Test ===")
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not deepseek_key:
        print("SKIP: No DEEPSEEK_API_KEY")
        return

    thin_site = {
        "meta": {"title": "SEO", "title_length": 3, "description": "", "description_length": 0, "og_title": "", "og_description": "", "og_image": "", "canonical": ""},
        "content": {"word_count": 200, "paragraph_count": 2},
        "headings": {"total": 2},
        "issues": [
            {"check": "Meta Title", "severity": "error", "message": "Missing"},
            {"check": "Meta Description", "severity": "error", "message": "Missing"},
            {"check": "Content Length", "severity": "warning", "message": "Thin"},
        ],
    }
    thin_classify = {"page_type": "article", "is_thin": True, "eeat_score": 10, "content_originality_risk": "high", "freshness_score": 20}
    thin_result = await predict_ranking("SEO", 30, thin_site, {"words_target": 2200}, thin_classify, deepseek_key)

    strong_site = {
        "meta": {"title": "The Ultimate Guide to Enterprise SEO Strategy in 2024", "title_length": 58, "description": "Learn proven enterprise SEO strategies from Fortune 500 companies. Comprehensive guide covering technical SEO, content strategy, and link building.", "description_length": 148, "og_title": "Ultimate Enterprise SEO Guide", "og_description": "Proven enterprise SEO strategies", "og_image": "https://example.com/og.jpg", "canonical": "https://example.com/seo-guide"},
        "content": {"word_count": 3500, "paragraph_count": 28},
        "headings": {"total": 22},
        "issues": [],
    }
    strong_classify = {"page_type": "article", "is_thin": False, "eeat_score": 85, "content_originality_risk": "low", "freshness_score": 90}
    strong_result = await predict_ranking("enterprise SEO", 92, strong_site, {"words_target": 2200, "headings_target": 15}, strong_classify, deepseek_key)

    print(f"  Thin content:  {thin_result['ranking_score']}/100 (expect < 50)")
    print(f"  Strong content: {strong_result['ranking_score']}/100 (expect > 70)")

    thin_ok = thin_result["ranking_score"] < 50
    strong_ok = strong_result["ranking_score"] > 70
    print(f"  Thin test: {'PASS' if thin_ok else 'FAIL (too high)'}")
    print(f"  Strong test: {'PASS' if strong_ok else 'FAIL (too low)'}")


async def main():
    print("X-Algorithm Scoring Pipeline — Validation Suite")
    print("=" * 50)
    await test_stability()
    await test_score_range()


if __name__ == "__main__":
    asyncio.run(main())
