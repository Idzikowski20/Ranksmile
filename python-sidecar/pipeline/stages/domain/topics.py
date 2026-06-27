"""TopicsStage — cluster keywords into 4–8 SEO topic groups via one LLM call."""
import os

import anthropic

from pipeline.contracts import AnalysisStage, StageContext
from pipeline.llm_json import parse_json_array

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(
            api_key=os.getenv("DEEPSEEK_API_KEY", ""),
            base_url="https://api.deepseek.com/anthropic",
        )
    return _client


MODEL = "deepseek-v4-flash"


async def _llm_cluster(domain: str, keywords: list[str]) -> list[dict] | None:
    """Single LLM call; returns parsed list or None on failure."""
    kw_list = ", ".join(keywords[:50])
    prompt = (
        f"Group these keywords into 4-8 SEO topic clusters for the domain {domain}. "
        f"Keywords: {kw_list}. "
        "Return ONLY valid JSON (no markdown, no explanation). Keep summaries short and "
        "do NOT use double-quote characters inside any string value. "
        '[{"title": "...", "summary": "...", "keyword_indexes": [0, 1, 2]}]'
    )
    client = _get_client()
    response = await client.messages.create(
        model=MODEL,
        max_tokens=1024,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
    )
    for block in response.content:
        if block.type == "text":
            parsed = parse_json_array(block.text)
            if not parsed:
                # Evidence: show what the model actually returned when it doesn't parse.
                print(f"[topics] LLM text unparseable ({len(block.text)} chars) head={block.text[:400]!r}")
            return parsed
    print(f"[topics] LLM response had no text block: {[b.type for b in response.content]}")
    return None


class TopicsStage(AnalysisStage):
    name = "topics"
    progress_weight = 0.2

    async def run(self, ctx: StageContext) -> dict:
        keywords: list[dict[str, str]] = ctx.get_state("keywords") or []
        domain: str = ctx.payload.get("domain", "")
        kw_strings = [k["keyword"] for k in keywords]

        # Evidence at the keywords → topics boundary: 0 keywords ⇒ the keywords stage
        # is the real culprit, not the topics LLM.
        print(f"[topics] input keywords={len(kw_strings)} sample={kw_strings[:5]}")

        await ctx.emit_progress(self, 20, "Clustering keywords into topic groups")

        topics: list[dict] | None = None
        try:
            topics = await _llm_cluster(domain, kw_strings)
        except Exception as exc:
            print(f"[topics] LLM call failed: {exc}")

        if topics is None:
            # Retry once on parse failure or exception
            try:
                topics = await _llm_cluster(domain, kw_strings)
            except Exception as exc:
                print(f"[topics] LLM retry failed: {exc}")
                topics = []

        if not isinstance(topics, list):
            topics = []

        # Attach topic_index back onto keywords in state
        for topic_idx, topic in enumerate(topics):
            for kw_idx in topic.get("keyword_indexes", []):
                if isinstance(kw_idx, int) and 0 <= kw_idx < len(keywords):
                    keywords[kw_idx]["topic_index"] = str(topic_idx)
        ctx.set_state("keywords", keywords)
        ctx.set_state("topics", topics)

        await ctx.emit_progress(self, 100, f"Topics ready: {len(topics)} clusters")
        return {"topics": topics}
