"""
Inflection regexps for NLP terms — the matching layer Surfer ships with its guidelines.

Surfer's `terms_to_use` carry a regexp per term word covering the word's full Polish
declension ("usłu(?:g(?:a(?:ch|mi)|om|[ię])|dze)"), so "usługa/usługi/usługach/usług"
all count as one term. Our scorer matched near-exact strings, which undercounts every
inflected occurrence and double-lists variants ("licencjonowany detektyw" vs
"licencjonowani detektywi") as separate terms.

The word family is built from the forms actually observed in the competitor corpus,
grouped by a deterministic suffix stem — spaCy's sm lemmatizer was tried first and
gives different lemmas for the same word in and out of phrase context, which breaks
the equality the dedupe key needs. The base word is always in its own group, so a
term still matches with an empty corpus.

ponytail: a hand-rolled suffix list, not morphology — an irregular form whose stem
shifts ("mieście"/"miasto") lands in a different group and is missed. Upgrade path
is Morfeusz2 or any generator that can enumerate declensions.
"""
from collections import defaultdict
import re

_FOLD = str.maketrans("ąćęłńóśźż", "acelnoszz")

#: Inflectional endings, longest first. Stripped up to twice ("ubezpieczenia" →
#: "ubezpieczeni" → "ubezpieczen"), never below a 4-letter stem.
_SUFFIXES = (
    "owie", "iego", "iemu",
    "ach", "ami", "ymi", "imi", "ego", "emu", "iej", "owi", "ych", "ich",
    "om", "em", "ie", "ej", "ow", "ym", "im",
    "a", "e", "i", "o", "u", "y",
)
_MIN_STEM = 4

#: Corpus budget per attach call — this runs inside deep-analysis; 8 pages x 40k chars
#: covers a SERP without stalling the pipeline.
#: ponytail: ceiling = inflected forms living past page 8 or char 40k are never observed,
#: so their term keeps only the forms found inside the budget; upgrade = stream the whole
#: corpus through _forms_by_stem once per analysis and cache it on the stage context.
MAX_TEXTS = 8
MAX_CHARS = 40_000

# Same quantifier as _TERM_WORD below on purpose: with {2,} the corpus dropped
# single-character tokens, so the two sides no longer split on the rule the TS
# scorer's rawTokenize uses and the symmetry this module exists to keep was broken.
_TOKEN = re.compile(r"[^\W_]+", re.UNICODE)
# One word of a term = one alternation. Split on the same rule the TS scorer's
# rawTokenize uses ([letters/digits]+), so a hyphenated term like "wykrywanie-podsluchow"
# becomes two words and two regexps that line up with the two tokens it produces —
# splitting on whitespace alone left one regexp facing two tokens and never matched.
_TERM_WORD = re.compile(r"[^\W_]+", re.UNICODE)


def stem(word: str) -> str:
    """Fold diacritics, lowercase, strip up to two inflectional endings."""
    s = word.lower().translate(_FOLD)
    for _ in range(2):
        for suffix in _SUFFIXES:
            if s.endswith(suffix) and len(s) - len(suffix) >= _MIN_STEM:
                s = s[: len(s) - len(suffix)]
                break
        else:
            break
    return s


def _forms_by_stem(texts: list[str]) -> dict[str, set[str]]:
    forms: dict[str, set[str]] = defaultdict(set)
    for text in texts[:MAX_TEXTS]:
        for token in _TOKEN.findall(text[:MAX_CHARS].lower()):
            forms[stem(token)].add(token)
    return forms


def _word_regexp(word: str, observed: set[str]) -> str:
    forms = {f for f in observed | {word} if f}
    # Longest first so the regexp engine cannot stop at a prefix of a longer form.
    alternation = "|".join(re.escape(f) for f in sorted(forms, key=len, reverse=True))
    return f"(?:{alternation})"


def _base_language(language: str) -> str:
    """"pl-PL" / "PL" / "pl_PL" -> "pl". Matches how the TS side reads language codes."""
    return re.split(r"[-_]", str(language or "").strip().lower(), maxsplit=1)[0]


def attach_lemma_regexps(
    terms: list[dict],
    texts: list[str],
    language: str = "pl",
) -> list[dict]:
    """
    Mutates each term dict in place, adding:
      term_words_regexps: one alternation per word of the term; the caller anchors it
      lemma_key: space-joined stem sequence — identical key means the same term in a
                 different inflection, which the TS side dedupes on.
    Returns the same list.
    """
    # _SUFFIXES is a Polish inflection table. Applied to English it is not merely
    # useless, it is worse than nothing: "services" does not stem to "service", so
    # the term gets an exact `(?:service)` regexp and the TS scorer honours it
    # instead of falling back to countOccurrences' fuzzy match — which did count
    # the plural. Leave non-Polish terms unannotated so that fallback survives.
    # ponytail: ceiling = only pl gets lemma matching; upgrade = a per-language
    # suffix table (or a real stemmer) keyed off `language`.
    #
    # Normalised first: callers pass the request's language through verbatim, so "pl-PL"
    # or "PL" would otherwise fail an exact match and silently disable annotation for a
    # Polish corpus — a worse regression than the English case this guard exists for.
    if _base_language(language) != "pl" or not terms:
        return terms

    corpus_forms = _forms_by_stem(texts)

    for term in terms:
        words = _TERM_WORD.findall(str(term.get("term", "")).lower())
        if not words:
            continue
        stems = [stem(w) for w in words]
        term["term_words_regexps"] = [
            _word_regexp(word, corpus_forms.get(s, set()))
            for word, s in zip(words, stems)
        ]
        term["lemma_key"] = " ".join(stems)
    return terms


def recalibrate_ranges_with_lemmas(
    terms: list[dict],
    texts: list[str],
) -> list[dict]:
    """
    Recompute suggested_min/max counting the SAME thing the scorer counts.

    The density ranges are first derived from exact whole-word counts of one inflected
    form, but the editor scores `current_count` through `term_words_regexps` — every
    form in the lemma group. For a Polish core term the two differ by an order of
    magnitude: article 97 was told "emocjonalnego: 6-12" and then scored 112, an
    automatic overshoot penalty on exactly the terms that matter most. Ranges must be
    measured with the same lemma-aware pattern, or the band grades a different quantity
    than the article is scored on.
    """
    if not terms or not texts:
        return terms
    lowered = [t.lower() for t in texts]
    for term in terms:
        regexps = term.get("term_words_regexps")
        if not isinstance(regexps, list) or not regexps:
            continue
        try:
            pattern = re.compile(
                r"(?<!\w)" + r"\s+".join(f"(?:{r})" for r in regexps) + r"(?!\w)",
                re.IGNORECASE,
            )
        except re.error:
            continue
        per_doc = [len(pattern.findall(lt)) for lt in lowered]
        nonzero = [(c, lt) for c, lt in zip(per_doc, lowered) if c > 0]
        if not nonzero:
            continue
        densities = sorted(c / max(1, len(lt.split())) for c, lt in nonzero)
        median_density = densities[len(densities) // 2]
        typical_words = sum(len(lt.split()) for lt in lowered) / len(lowered)
        expected = median_density * typical_words
        density_cap = max(15, round(typical_words * 0.035))
        s_max = min(density_cap, max(2, round(expected * 1.4)))
        # Min scales with the capped max, or the cap could leave min above max.
        s_min = min(max(1, round(expected * 0.6)), max(1, s_max - 1))
        term["suggested_min"] = s_min
        term["suggested_max"] = s_max
        term["target_count"] = max(1, round(expected))
    return terms
