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
MAX_TEXTS = 8
MAX_CHARS = 40_000

_TOKEN = re.compile(r"[^\W\d_]{2,}", re.UNICODE)


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
    del language  # same suffix table serves pl and (harmlessly) en corpora
    if not terms:
        return terms

    corpus_forms = _forms_by_stem(texts)

    for term in terms:
        words = [w for w in str(term.get("term", "")).lower().split() if w]
        if not words:
            continue
        stems = [stem(w) for w in words]
        term["term_words_regexps"] = [
            _word_regexp(word, corpus_forms.get(s, set()))
            for word, s in zip(words, stems)
        ]
        term["lemma_key"] = " ".join(stems)
    return terms
