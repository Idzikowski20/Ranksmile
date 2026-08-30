"""TF-IDF term extraction + Polish phrase filters — shared by serp_analyzer and semantic_terms."""
import re
import unicodedata

from sklearn.feature_extraction.text import TfidfVectorizer

# Inflected function words the original list missed. They are not vocabulary an article
# can be graded on, but they survive TF-IDF and shipped as scored terms: article 84 was
# told to use "ktorych", "jednak", "czego" and "osobe" at competitor-level frequencies.
_FUNCTION_WORD_FORMS = {
    "ktorych", "ktorym", "ktora", "ktorej", "ktorego", "jednak", "czego", "czemu",
    "osobe", "osoby", "osobie", "osoba", "sobie", "siebie", "swoje", "swojego", "swoja",
    "takze", "rowniez", "wiec", "zatem", "ponadto", "natomiast", "jednakze", "bowiem",
    "wowczas", "wtedy", "teraz", "potem", "zawsze", "nigdy", "czesto", "czasami",
    "bardzo", "wcale", "jedynie", "tylko", "nawet", "prawie", "okolo", "wedlug",
    "kazdy", "kazda", "kazde", "wszystkie", "wszystkich", "innych", "inne", "inny",
    "jedna", "jeden", "jedno", "jednej", "jednym", "zyciu", "zycie", "zycia",
    "swoich", "swoim", "swoja", "czuje", "czuc", "moze", "musi", "trzeba",
    "bezplatna", "bezplatny", "bezplatne",
    "temu", "tego", "tym", "tej", "ten", "tego", "przez", "przy", "podczas",
}

# Core grammar words only — prepositions, conjunctions, pronouns, auxiliaries. A
# multi-word phrase may legitimately contain one INSIDE it ("szantaz emocjonalny w
# zwiazku", "miec trudnosci"); the extended set below is for judging single words.
GRAMMAR_STOPWORDS = {
    "aby", "ale", "albo", "ani", "bez", "bo", "by", "byc", "byl", "byla", "bylo",
    "byly", "czy", "dla", "do", "gdy", "gdzie", "go", "ich", "im", "jest",
    "jesli", "juz", "kiedy", "kto", "ktora", "ktore", "ktory", "lub", "ma",
    "mial", "miec", "mnie", "moze", "mozna", "na", "nad", "nam", "nas", "nie",
    "nim", "niz", "oraz", "po", "pod", "przed", "przez", "przy", "sa", "sie",
    "sobie", "tak", "takze", "tego", "tej", "ten", "teraz", "tez", "to",
    "tych", "tym", "u", "w", "we", "z", "za", "ze", "zeby", "warto",
    "cie", "ci", "mi", "mnie", "nam", "was", "wam",
    "nalezy", "czasem", "sytuacja", "informacje", "wielu", "jak",
}

# Everything a SINGLE-word term must not be: grammar words plus the inflected function
# forms TF-IDF kept shipping as scored vocabulary ("ktorych", "jednak", "osobe").
# Reference check: 9 of the 12 Surfer guideline terms our filters rejected were killed
# by the function-form set matching a word INSIDE a phrase — "druga osobe", "naszym
# zyciu", "osoby szantazowanej" are real collocations even though "osobe" alone is junk.
# Hence the split: phrases are judged against GRAMMAR_STOPWORDS, singles against this.
POLISH_STOPWORDS = _FUNCTION_WORD_FORMS | GRAMMAR_STOPWORDS

GENERIC_TERMS = {
    "strona", "artykul", "tekst", "temat", "firma", "firmy", "osoba", "osoby",
    "przypadek", "przyklad", "mozliwosc", "rozwiazanie",
}


def normalize_text(text: str) -> str:
    """ASCII-fold for TF-IDF matching. Map Polish diacritics (incl. ł→l) before stripping."""
    pl_map = str.maketrans({
        "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n",
        "ó": "o", "ś": "s", "ź": "z", "ż": "z",
        "Ą": "a", "Ć": "c", "Ę": "e", "Ł": "l", "Ń": "n",
        "Ó": "o", "Ś": "s", "Ź": "z", "Ż": "z",
    })
    normalized = (text or "").lower().translate(pl_map)
    normalized = unicodedata.normalize("NFD", normalized)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = re.sub(r"[^a-z0-9\s-]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


# Page furniture, not topic language: cookie/consent banners, URL and CMS fragments,
# dictionary/translator chrome, music-database metadata. These reached the term list from
# competitor boilerplate ("partners can use", "index php title", "song duration 2:58")
# and each uncovered one drags the score of an article that rightly never says them.
_BOILERPLATE_RE = re.compile(
    r"cookie|consent|privacy policy|polityka prywatno|partners can|can use this|"
    r"click here|kliknij tutaj|all rights reserved|wszelkie prawa|newsletter|"
    r"index php|php title|https?|www|\.com|\.pl|"
    r"dictionary|dictionaries|słownik|thesaurus|translation|tłumaczenie|wymowa|"
    r"pronunciation|noun declension|syllable|"
    r"song duration|based on this song|records dk|popular releases|tracklist",
    re.IGNORECASE,
)


# Function words and site chrome that mark a TF-IDF shingle crossing a sentence or a
# menu, not a phrase anyone would target: "jedna jezeli ktos", "menu glownego przejdz".
_EDGE_JUNK = {
    "jezeli", "jesli", "ktos", "kogos", "jedna", "jeden", "oraz", "albo", "lub",
    "przejdz", "menu", "glownego", "zobacz", "czytaj", "wiecej", "kliknij", "tutaj",
}



def _fold(word: str) -> str:
    """Diacritics stripped for set membership — the stopword sets store folded forms
    ("ktora", "ze"), and comparing raw tokens ("która", "że") against them never
    matched: article 107 shipped "sprawia że" and "osobie która" as scored
    collocations while "poczucie winy" fell past the cap they flooded."""
    normalized = unicodedata.normalize("NFD", word)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn").replace(chr(0x0142), "l")


def is_useful_phrase(phrase: str) -> bool:
    tokens = [_fold(t) for t in phrase.split() if t]
    if not tokens:
        return False
    # A multi-word phrase that starts or ends on a function word is a broken shingle.
    if len(tokens) >= 2 and (tokens[0] in _EDGE_JUNK or tokens[-1] in _EDGE_JUNK):
        return False
    if any(t in {"menu", "przejdz", "kliknij"} for t in tokens):
        return False
    if _BOILERPLATE_RE.search(phrase):
        return False
    # A phrase that is mostly digits is an ID or a timestamp, not a topic.
    digits = sum(c.isdigit() for c in phrase)
    if digits > len(phrase) / 3:
        return False
    if all(t in POLISH_STOPWORDS or t in GENERIC_TERMS for t in tokens):
        return False
    if len(tokens) == 1:
        return tokens[0] not in POLISH_STOPWORDS and len(tokens[0]) >= 5
    # Multi-word: only the EDGES must be content words, and only core grammar disqualifies
    # them — "druga osobe" and "naszym zyciu" are collocations Surfer's own guideline
    # lists, while "czym jest szantaz" still dies on its grammar-word edge.
    if tokens[0] in GRAMMAR_STOPWORDS or tokens[-1] in GRAMMAR_STOPWORDS:
        return False
    # Interior grammar words are fine ("szantaz emocjonalny w zwiazku"); a phrase that is
    # MOSTLY function words is still noise.
    weak = sum(t in POLISH_STOPWORDS for t in tokens)
    return weak <= len(tokens) // 2


def extract_nlp_terms(texts: list[str], keyword: str) -> list[dict]:
    """TF-IDF n-grams from competitor pages — Ranksmile-style phrase discovery."""
    if not texts:
        return []

    n_docs = len(texts)
    normalized_texts = [normalize_text(text) for text in texts]

    # Short SERP-snippet corpora need min_df=1 or TF-IDF returns almost nothing.
    min_df = 1 if n_docs <= 5 else max(2, int(n_docs * 0.25))
    try:
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 3),
            max_features=400,
            stop_words=list(POLISH_STOPWORDS),
            min_df=min_df,
            token_pattern=r"(?u)\b[a-z0-9][a-z0-9-]{2,}\b",
        )
        vectorizer.fit_transform(normalized_texts)
        candidate_terms: set[str] = set(vectorizer.get_feature_names_out())
    except Exception as exc:
        print(f"[competitor_terms] TF-IDF error: {exc}")
        candidate_terms = set()

    result_by_term: dict[str, dict] = {}

    kw = normalize_text(keyword)
    if kw and is_useful_phrase(kw):
        kw_total = sum(t.count(kw) for t in normalized_texts)
        result_by_term[kw] = {
            "term": kw,
            "target_count": max(1, round(kw_total / n_docs)),
            "doc_freq": n_docs,
        }

    for term in candidate_terms:
        if not is_useful_phrase(term):
            continue
        doc_counts = [t.count(term) for t in normalized_texts]
        docs_with_term = sum(1 for c in doc_counts if c > 0)
        if docs_with_term < min_df:
            continue
        avg_across_all = sum(doc_counts) / n_docs
        result_by_term[term] = {
            "term": term,
            "target_count": max(1, round(avg_across_all)),
            "doc_freq": docs_with_term,
        }

    result = list(result_by_term.values())
    result.sort(key=lambda x: (x["doc_freq"], x["target_count"]), reverse=True)
    return [{"term": r["term"], "target_count": r["target_count"], "doc_freq": r["doc_freq"]} for r in result[:80]]


def extract_collocations(texts: list[str], max_terms: int = 40) -> list[dict]:
    """
    Frequent word-pairs across competitor pages, kept in their inflected form.

    Surfer's exported guideline is built from exactly this shape — "poczucia winy",
    "wlasnych granic", "zachowanie spokoju" — natural collocations the ranking pages
    repeat. Two hard-learned rules from the first version, which flooded the list with
    "cennik kontakt" and "bede cie":
      * pairs never cross a sentence boundary — tokenize per sentence, not per page;
      * neither word may be a function word, and both need 4+ characters. A single
        permitted stopword let every "chcesz sie" through.
    Inflection variants are merged by stem so "poczucie winy" and "poczucia winy" count
    as one term; the most frequent surface form is what ships.
    """
    if len(texts) < 2:
        return []
    import re as _re
    token_re = _re.compile(
        r"[a-zA-Ząćęłńóśźż"
        r"ĄĆĘŁŃÓŚŹŻ]{1,}"
    )
    sentence_re = _re.compile("[.!?\\n\\r]+")

    def _stem(w: str) -> str:
        # "ia"/"iu" before "a"/"u": poczucia -> poczuc (matches poczucie -> poczuc),
        # or the genitive and nominative land on different stems and never merge.
        for suf in ("ami", "ach", "owi", "iem", "ia", "iu", "ie", "em", "om", "ow", "ej", "a", "e", "i", "o", "u", "y"):
            if len(w) - len(suf) >= 4 and w.endswith(suf):
                return w[: len(w) - len(suf)]
        return w

    doc_freq: dict[str, int] = {}
    occurrences: dict[str, int] = {}
    surface_counts: dict[str, dict[str, int]] = {}
    for text in texts:
        seen_here: set[str] = set()
        for sentence in sentence_re.split(text.lower()):
            tokens = token_re.findall(sentence)
            def _note(words: tuple[str, ...]) -> None:
                key = " ".join(_stem(w) for w in words)
                surface = " ".join(words)
                occurrences[key] = occurrences.get(key, 0) + 1
                surface_counts.setdefault(key, {})
                surface_counts[key][surface] = surface_counts[key].get(surface, 0) + 1
                if key not in seen_here:
                    doc_freq[key] = doc_freq.get(key, 0) + 1
                    seen_here.add(key)

            # 2-4-grams. Edges must be content words; ONE grammar word may sit inside —
            # the reference guideline's own shapes are exactly this: "poczucia winy",
            # "mechanizmow szantazu emocjonalnego", "szantaz emocjonalny w zwiazku".
            n = len(tokens)
            folded = [_fold(t) for t in tokens]
            for i in range(n):
                if folded[i] in GRAMMAR_STOPWORDS:
                    continue
                for size in (2, 3, 4):
                    j = i + size
                    if j > n:
                        break
                    if folded[j - 1] in GRAMMAR_STOPWORDS:
                        continue
                    inner_grammar = sum(w in GRAMMAR_STOPWORDS for w in folded[i + 1:j - 1])
                    if inner_grammar > 1:
                        continue
                    _note(tuple(tokens[i:j]))
    n_docs = len(texts)
    floor = max(2, round(0.4 * n_docs))
    out = []
    for key, df in sorted(doc_freq.items(), key=lambda kv: (-kv[1], kv[0])):
        if df < floor:
            continue
        surface = max(surface_counts[key].items(), key=lambda kv: kv[1])[0]
        if not is_useful_phrase(surface):
            continue
        avg = max(1, round(occurrences[key] / df))
        out.append({
            "term": surface, "target_count": min(avg, 6), "type": "collocation",
            "relevance": 0.6, "doc_freq": df,
            "suggested_min": 1, "suggested_max": max(2, min(avg + 1, 8)),
        })
        if len(out) >= max_terms:
            break
    return out


def extract_content_singles(texts: list[str], max_terms: int = 20) -> list[dict]:
    """
    High-frequency single content lemmas — the reference guideline's fourth term shape.

    Surfer lists bare nouns with wide bands ("poczucie: 12-26", "relacji: 18-42",
    "granice: 8-23"): the vocabulary every ranking page leans on. Entities and
    collocations both miss them — an entity extractor wants names, a collocation wants
    pairs. A word counts when MOST pages use it (60% of the cohort); ranges are later
    recalibrated with lemma regexps like every other term.
    """
    if len(texts) < 2:
        return []
    import re as _re
    token_re = _re.compile(
        r"[a-zA-Ząćęłńóśźż]{5,}"
    )

    def _stem(w: str) -> str:
        w = _fold(w)
        for suf in ("ami", "ach", "owi", "iem", "ia", "iu", "ie", "em", "om", "ow", "ej", "a", "e", "i", "o", "u", "y"):
            if len(w) - len(suf) >= 4 and w.endswith(suf):
                return w[: len(w) - len(suf)]
        return w

    doc_freq: dict[str, int] = {}
    occurrences: dict[str, int] = {}
    surface_counts: dict[str, dict[str, int]] = {}
    for text in texts:
        seen_here: set[str] = set()
        for w in token_re.findall(text.lower()):
            if _fold(w) in POLISH_STOPWORDS or _fold(w) in GENERIC_TERMS:
                continue
            key = _stem(w)
            occurrences[key] = occurrences.get(key, 0) + 1
            surface_counts.setdefault(key, {})
            surface_counts[key][w] = surface_counts[key].get(w, 0) + 1
            if key not in seen_here:
                doc_freq[key] = doc_freq.get(key, 0) + 1
                seen_here.add(key)
    n_docs = len(texts)
    floor = max(2, round(0.6 * n_docs))
    out = []
    for key, df in sorted(doc_freq.items(), key=lambda kv: (-occurrences[kv[0]], kv[0])):
        if df < floor:
            continue
        surface = max(surface_counts[key].items(), key=lambda kv: kv[1])[0]
        if not is_useful_phrase(surface):
            continue
        avg = max(1, round(occurrences[key] / df))
        out.append({
            "term": surface, "target_count": min(avg, 12), "type": "supporting",
            "relevance": 0.55, "doc_freq": df,
            "suggested_min": max(1, avg // 2), "suggested_max": max(2, min(avg + 2, 26)),
        })
        if len(out) >= max_terms:
            break
    return out
