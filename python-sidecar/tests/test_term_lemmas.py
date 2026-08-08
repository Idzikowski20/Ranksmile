import re

from analyzers.term_lemmas import attach_lemma_regexps, stem

CORPUS = [
    "Nasze usługi detektywistyczne obejmują obserwację. Korzystanie z usług "
    "detektywistycznych w Warszawie jest legalne. Usługa detektywistyczna wymaga licencji.",
]


def _matches(regexps: list[str], phrase: str) -> bool:
    words = phrase.lower().split()
    if len(words) != len(regexps):
        return False
    return all(re.fullmatch(rx, w) for rx, w in zip(regexps, words))


def test_regexps_cover_corpus_inflections():
    terms = attach_lemma_regexps([{"term": "usługi detektywistyczne"}], CORPUS)
    rx = terms[0]["term_words_regexps"]

    # Every declension the corpus used counts as the same term.
    assert _matches(rx, "usługi detektywistyczne")
    assert _matches(rx, "usług detektywistycznych")
    assert _matches(rx, "usługa detektywistyczna")
    # A different word does not ride along on a shared prefix.
    assert not re.fullmatch(rx[0], "usterka")


def test_same_lemma_key_for_inflection_variants():
    terms = attach_lemma_regexps(
        [{"term": "licencjonowany detektyw"}, {"term": "licencjonowani detektywi"}],
        CORPUS,
    )
    assert terms[0]["lemma_key"] == terms[1]["lemma_key"]


def test_distinct_words_keep_distinct_stems():
    # The old fuzzy matcher counted "detektywistyczne" as "detektyw" (shared prefix).
    assert stem("detektyw") != stem("detektywistyczne")
    assert stem("ubezpieczenie") == stem("ubezpieczenia")
    assert stem("usługa") == stem("usług") == stem("usługi")


def test_works_without_corpus_and_escapes_specials():
    terms = attach_lemma_regexps([{"term": "c++ (audyt)"}], [])
    for rx in terms[0]["term_words_regexps"]:
        re.compile(rx)  # must not throw
