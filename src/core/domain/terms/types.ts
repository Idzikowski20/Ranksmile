/** NLP term with target/current usage + competitor-derived salience & lemma data. */
export interface NlpTerm {
  term: string;
  target_count: number;
  current_count?: number;
  /** Competitor-derived usage range (Ranksmile "suggested" column). */
  suggested_min?: number;
  suggested_max?: number;
  relevance?: number;
  doc_freq?: number;
  /** 0–100 prominence from competitor H2/bold/font-weight zones (Ranksmile NLP salience v2). */
  salience?: number;
  /** Per-word inflection alternations from the sidecar (term_lemmas.py) — Surfer-style
   *  lemma matching. Absent on pre-existing analyses; countOccurrences falls back. */
  term_words_regexps?: string[];
  /** Stem-sequence identity: equal keys are the same term in different inflections. */
  lemma_key?: string;
}
