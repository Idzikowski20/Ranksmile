"""Shared chat backend for the sidecar's auxiliary LLM calls.

Every analyzer used to POST straight to api.deepseek.com with its own key gate.
When that account ran out of balance (HTTP 402) term extraction, image prompts,
content classification, ranking commentary and recommendations all silently
degraded to their fallbacks — while the article writer kept working fine through
OpenRouter. One resolver: OpenRouter first (same account the writer uses, with
reasoning pinned off for gpt-5-class models), DeepSeek as the fallback, None when
neither key exists so callers keep their deterministic fallbacks.
"""
import os


def chat_config() -> dict | None:
    """Backend for an OpenAI-compatible /chat/completions POST, or None."""
    openrouter_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if openrouter_key:
        return {
            "url": "https://openrouter.ai/api/v1/chat/completions",
            "key": openrouter_key,
            "model": "openai/gpt-5.6-luna",
            # Judges and extractors want output, not chains of thought — without this
            # the default reasoning effort can burn the whole completion budget.
            "extra": {"reasoning": {"effort": "minimal", "exclude": True}},
        }
    deepseek_key = (os.getenv("DEEPSEEK_API_KEY") or "").strip()
    if deepseek_key:
        return {
            "url": "https://api.deepseek.com/v1/chat/completions",
            "key": deepseek_key,
            "model": "deepseek-chat",
            "extra": {},
        }
    return None


def chat_payload(cfg: dict, messages: list[dict], max_tokens: int, temperature: float = 0.1) -> dict:
    """The POST body for `cfg` — model + backend-specific extras merged in."""
    return {
        "model": cfg["model"],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": messages,
        **cfg["extra"],
    }


def chat_headers(cfg: dict) -> dict:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cfg['key']}",
    }
