"""Shared LLM language instructions for domain-configured locales."""

_LANG_HINTS: dict[str, str] = {
    "pl": " Write ALL output in Polish (polski).",
    "de": " Write ALL output in German.",
    "fr": " Write ALL output in French.",
    "es": " Write ALL output in Spanish.",
    "it": " Write ALL output in Italian.",
    "nl": " Write ALL output in Dutch.",
    "pt": " Write ALL output in Portuguese.",
    "en": " Write ALL output in English.",
}


def language_instruction(language: str) -> str:
    code = (language or "en").lower()[:2]
    return _LANG_HINTS.get(code, f" Write ALL output in {language_display_name(code)}.")


def language_display_name(code: str) -> str:
    names = {
        "pl": "Polish",
        "en": "English",
        "de": "German",
        "fr": "French",
        "es": "Spanish",
        "it": "Italian",
        "nl": "Dutch",
        "pt": "Portuguese",
    }
    return names.get(code.lower()[:2], "English")
