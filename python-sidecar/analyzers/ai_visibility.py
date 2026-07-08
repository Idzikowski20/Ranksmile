import os
import re
import unicodedata
from urllib.parse import urlparse

import httpx


def normalize(text: str) -> str:
    value = unicodedata.normalize("NFD", (text or "").lower())
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", value).strip()


def build_prompts(keyword: str) -> list[str]:
    return [
        f"Co to jest {keyword}?",
        f"Jak sprawdzic {keyword}?",
        f"Jakie sa najwazniejsze objawy lub sygnaly dla: {keyword}?",
        f"Co zrobic krok po kroku w temacie: {keyword}?",
        f"Jakie zrodla najlepiej wyjasniaja temat: {keyword}?",
    ]


def domain_from_url(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def article_answer_score(article_content: str, prompt: str, keyword: str) -> int:
    text = normalize(article_content)
    if not text:
        return 0

    prompt_tokens = {
        token
        for token in re.findall(r"[a-z0-9-]{4,}", normalize(f"{prompt} {keyword}"))
        if token not in {"jakie", "jest", "temat", "krok", "zrobic", "najwazniejsze"}
    }
    if not prompt_tokens:
        return 0

    covered = sum(1 for token in prompt_tokens if token in text)
    coverage = covered / len(prompt_tokens)

    answer_patterns = [
        r"\bco to jest\b",
        r"\bjak sprawdzic\b",
        r"\bobjawy\b",
        r"\bsygnaly\b",
        r"\bkrok\b",
        r"\bnajczestsze pytania\b",
        r"\bfaq\b",
    ]
    structure_bonus = sum(1 for pattern in answer_patterns if re.search(pattern, text))
    length_bonus = min(len(text.split()) / 1200, 1)
    return round(min(100, coverage * 60 + structure_bonus * 7 + length_bonus * 20))


async def fetch_search_evidence(prompt: str, api_key: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": prompt, "hl": "pl", "gl": "pl", "num": 5},
        )
        response.raise_for_status()
        data = response.json()
        return data.get("organic", [])[:5]


async def run_ai_visibility(
    keyword: str,
    own_domain: str,
    competitor_domains: list[str],
    article_content: str = "",
) -> dict:
    prompts = build_prompts(keyword)
    citations = []
    serper_key = os.getenv("SERPER_API_KEY", "")
    normalized_own_domain = (own_domain or "").replace("www.", "")
    competitor_domain_set = {domain.replace("www.", "") for domain in competitor_domains if domain}

    if not serper_key:
        prompt_scores = [
            {
                "prompt": prompt,
                "answer_readiness_score": article_answer_score(article_content, prompt, keyword),
            }
            for prompt in prompts
        ]
        avg_readiness = round(sum(p["answer_readiness_score"] for p in prompt_scores) / len(prompt_scores))
        return {
            "prompts_total": len(prompts),
            "prompts_cited": 0,
            "competitor_citations": 0,
            "extractability_score": avg_readiness,
            "citations": prompt_scores,
            "warning": "SERPER_API_KEY not configured; score uses article readiness only",
        }

    async def _fetch_prompt(prompt: str) -> list[dict]:
        try:
            organic = await fetch_search_evidence(prompt, serper_key)
        except Exception as exc:
            return [{
                "prompt": prompt,
                "answer": f"Search evidence failed: {exc}",
                "answer_readiness_score": article_answer_score(article_content, prompt, keyword),
            }]

        readiness = article_answer_score(article_content, prompt, keyword)
        if not organic:
            return [{
                "prompt": prompt,
                "answer": "",
                "answer_readiness_score": readiness,
            }]

        results = []
        for item in organic:
            url = item.get("link", "")
            domain = domain_from_url(url)
            results.append({
                "prompt": prompt,
                "answer": item.get("snippet", ""),
                "cited_url": url,
                "cited_domain": domain,
                "is_own_domain": bool(normalized_own_domain and domain == normalized_own_domain),
                "is_competitor": domain in competitor_domain_set,
                "answer_readiness_score": readiness,
            })
        return results

    import asyncio
    per_prompt_results = await asyncio.gather(*(_fetch_prompt(p) for p in prompts))
    for results in per_prompt_results:
        citations.extend(results)

    readiness_scores = [
        c.get("answer_readiness_score", 0)
        for c in citations
        if c.get("answer_readiness_score") is not None
    ]
    extractability_score = round(sum(readiness_scores) / max(len(readiness_scores), 1))
    prompts_cited = len({c["prompt"] for c in citations if (c.get("answer_readiness_score") or 0) >= 60})
    competitor_citations = len([c for c in citations if c.get("is_competitor")])

    return {
        "prompts_total": len(prompts),
        "prompts_cited": prompts_cited,
        "competitor_citations": competitor_citations,
        "extractability_score": extractability_score,
        "citations": citations,
    }
