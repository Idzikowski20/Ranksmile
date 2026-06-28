"""Generate short social-media promo posts from an article (3 distinct variants)."""
import json
import re

from pipeline.article_pipeline import _chat


async def generate_social_posts(content_html: str, keyword: str = "") -> dict:
    text = re.sub(r"<[^>]+>", " ", content_html or "")
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return {"variants": []}

    prompt = f"""You write social-media promo posts. Based on the ARTICLE below (topic: "{keyword}"),
write 3 DISTINCT social posts that promote it and drive clicks. Each post: 60-160 words, with a
strong hook, 2-4 short value points, and a soft call-to-action. Write in the ARTICLE's language.

Return ONLY JSON, no prose:
{{"variants":["<p>post 1</p>","<p>post 2</p>","<p>post 3</p>"]}}
Each variant must be valid HTML using only these tags: p, strong, em, ul, li.

ARTICLE:
{text[:8000]}"""

    try:
        raw = await _chat(prompt, max_tokens=2000)
        match = re.search(r"\{[\s\S]*\}", raw)
        if not match:
            return {"variants": []}
        data = json.loads(match.group(0))
        variants = [str(v).strip() for v in (data.get("variants") or []) if str(v).strip()][:3]
        return {"variants": variants}
    except Exception as exc:  # noqa: BLE001
        print(f"[social_posts] failed: {exc}")
        return {"variants": []}
