"""TF-IDF term extraction + Polish phrase filters — shared by serp_analyzer and semantic_terms."""
import re
import unicodedata

from sklearn.feature_extraction.text import TfidfVectorizer

POLISH_STOPWORDS = {
    "aby", "ale", "albo", "ani", "bez", "bo", "by", "byc", "byl", "byla", "bylo",
    "byly", "czy", "dla", "do", "gdy", "gdzie", "go", "ich", "im", "jest",
    "jesli", "juz", "kiedy", "kto", "ktora", "ktore", "ktory", "lub", "ma",
    "mial", "miec", "mnie", "moze", "mozna", "na", "nad", "nam", "nas", "nie",
    "nim", "niz", "oraz", "po", "pod", "przed", "przez", "przy", "sa", "sie",
    "sobie", "tak", "takze", "tego", "tej", "ten", "teraz", "tez", "to",
    "tych", "tym", "u", "w", "we", "z", "za", "ze", "zeby", "warto",
    "nalezy", "czasem", "sytuacja", "informacje", "wielu", "jak",
}

GENERIC_TERMS = {
    "strona", "artykul", "tekst", "temat", "firma", "firmy", "osoba", "osoby",
    "przypadek", "przyklad", "mozliwosc", "rozwiazanie",
}


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text.lower())
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", normalized).strip()


def is_useful_phrase(phrase: str) -> bool:
    tokens = [t for t in phrase.split() if t]
    if not tokens:
        return False
    if all(t in POLISH_STOPWORDS or t in GENERIC_TERMS for t in tokens):
        return False
    if len(tokens) == 1 and (tokens[0] in POLISH_STOPWORDS or len(tokens[0]) < 5):
        return False
    return not any(t in POLISH_STOPWORDS for t in tokens)


def extract_nlp_terms(texts: list[str], keyword: str) -> list[dict]:
    """TF-IDF n-grams from competitor pages — Surfer-style phrase discovery."""
    if not texts:
        return []

    n_docs = len(texts)
    normalized_texts = [normalize_text(text) for text in texts]

    min_df = max(2, int(n_docs * 0.3))
    try:
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 3),
            max_features=300,
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
