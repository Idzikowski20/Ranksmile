from analyzers.competitor_terms import is_useful_phrase


def test_boilerplate_and_reference_chrome_is_rejected():
    junk = [
        "partners can use",
        "can use this",
        "index php title",
        "polish dictionaries at pwn",
        "recommended based on this song",
        "song duration 2:58",
        "2094662 records dk",
        "polish noun declension",
        "cookie settings",
    ]
    for phrase in junk:
        assert not is_useful_phrase(phrase), phrase


def test_real_topic_phrases_survive():
    good = [
        "kara pozbawienia wolnosci",
        "szantaz emocjonalny",
        "zabezpieczenie dowodow",
        "art. 191 kodeksu karnego",
    ]
    for phrase in good:
        assert is_useful_phrase(phrase), phrase
