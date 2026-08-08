# AI Search parity — from 57 to Surfer's 98

Source of truth: `ranksmile-article-12-developer-report.json` (article 12, keyword
"prywatny detektyw warszawa") measured against `surfer-guidelines-*-08-08-2026.txt`
for the same keyword. Scores decompose as:

```
AI Search 15 = knowledge 8.4/48 (6 of 16 items covered) × weight → 14.9
             + early-answer bonus 0/15   (answers_main_question_early: false)
overall 57  = blend of SEO 92 and AI 15
```

Structure gap (same word count, different shape):

```
            Surfer          us
words       1400–1610       1504  ✅
headings    23–28           8     (7×H2, 0×H3)
paragraphs  55–66           21
lists       many            0
tables      1               0
terms       81 w/ ranges    16
facts       ~50 grouped     0 delivered to writer
questions   4 pricing       paa_questions: []
```

Ordering: tasks 1–2 move the score most for the least code; 6 is correctness and
cheap, so it rides with 1–2; 3 rebuilds visible structure; 4–5 widen the inputs.

---

## Task 1 — Coverage items reach the planner (15 → ~70)

**Root cause.** The coverage engine harvests 16 knowledge items (ids like
`paa-citation-*`, sources `chat_gpt/gemini/perplexity`) and judges the article
against them — but the planner never sees them. `paa_questions` in score_data is
`[]`; the brief's `must answer` comes only from KG questions. 10 of 16 uncovered
items are pricing/ranking questions no section was ever asked to answer.

**Where the data is.** Snapshot persisted at `articles.ai_info_to_cover`
(deep-analysis.ts:1125), parsed by `parseSnapshot` (lib/coverageStore.ts:85).
Items carry `label`, `category`, `importance`, `covered`.

**Change.**
- `pages/api/articles/[id]/content-plan.ts` + `[id]/generate.ts`: load
  `ai_info_to_cover`, parse, take items with `category: 'knowledge' | 'intent'`,
  map labels → strings.
- Feed them into `runContentPlanner` as `paaQuestions` (input already exists —
  they become TargetQuestions and get assigned to sections via existing
  machinery, no planner changes).
- `briefWriter.ts`: raise `QUESTIONS_PER_SECTION` (3 → 5) so pricing questions
  survive the per-section cap; system prompt gains one line — a `must answer`
  question is answered in prose, not restated.

**Verify.** Unit: content-plan passes coverage labels into the planner (mock the
row). Live: scratch run shows brief bullets answering "Ile bierze detektyw za
dzień obserwacji?"; after regeneration `covered_count` ≥ 13/16 in a fresh report.

## Task 2 — Early-answer lead (+15)

**Root cause.** Judge checks `answersMainQuestionEarly`; our lead opens with
context, never the answer. Flat 15 points.

**Change.**
- `briefWriter.ts` system prompt: first section's first bullet must be "Odpowiedz
  wprost na <main query> w pierwszych 2 zdaniach: ..." — the direct answer, then
  context.
- `python-sidecar/pipeline/section_writer.py`: when `context.index == 0`, prepend
  rule "Open with the direct answer to the article's main question; no wind-up."

**Verify.** briefWriter prompt test + sidecar pytest on the index-0 prompt. Live:
fresh report has `answers_main_question_early: true`.

## Task 3 — Format budget reaches the writer (structure parity)

**Root cause.** `section_writer._prompt` hard-rules "Write ONE paragraph …
Markdown only", so every block is a `<p>`. The plan's budgets
(`budget.lists`, `targetTables`, `headings_target: 15`) never translate into
block types — 0 lists, 0 tables, 0 H3 is structural, not stylistic.

**Change.**
- `lib/contentPlanner/knowledgePack/toSidecarCompiledPlan.ts` (+ executionPlan):
  give each ParagraphPlan a `block: 'paragraph' | 'list' | 'table' | 'h3'`,
  allocated from section budget — a section with `budget.lists ≥ 1` plans one
  list block; one table article-wide (comparison table like Surfer's
  "Kryterium/ProDetektyw"); sections over ~180 words get an `h3` split so total
  headings land in the benchmark band (23–28).
- `section_writer.py`: prompt per block kind — list → "Markdown bullet list,
  4–7 items, no intro sentence"; table → small Markdown table; h3 → `### `
  subheading + short paragraph. Paragraph stays the default.
- briefWriter: middle bullets may say "Wypunktuj: …" (Surfer's shape) — writer
  now has a block to satisfy it.

**Verify.** pytest: block kinds produce list/table/h3 markdown. Live: article has
`li > 0`, `table ≥ 1`, headings ≥ 15, paragraphs ≥ 40. cssKeyframes-style guard
not needed; postWrite validator already counts h2/lists — extend it to fail a
plan that budgeted lists and delivered none.

## Task 4 — Terms: 16 vs Surfer's 81

**Root cause (to confirm with data).** Pipeline logs counts at
deep-analysis.ts:648 (`terms before filter`) and :672 (`after`). Chain:
`mergeNlpTerms → filterUsefulNlpTerms → filterNlpTermsForAnalysis`. Same failure
class as the earlier 12/39 measurement — the filter distrusts anything without a
seed token, and single-word/branded variants fall out.

**Change.**
1. Run one fresh deep analysis, read both log lines — identify which stage eats
   the most.
2. Loosen that stage: `doc_freq >= 2` already bypasses; likely additions —
   accept `salience ≥ 30` singles, stop dropping inflection variants
   (`licencjonowany detektyw` vs `licencjonowani detektywi` both kept ✅ — but
   check what died), keep branded/generic pairs Surfer keeps
   ("detektyw", "podsłuchów", "sprawy" — high-volume unigrams with ranges).
3. Regression test with a realistic 80-term fixture asserting ≥ 60 survive.

**Verify.** `score_data.terms.length ≥ 50` on a fresh analysis; content score
still computes (termWeight handles the longer list).

## Task 5 — FACTS TO INCLUDE, grouped by topic

**Root cause.** Surfer hands the writer ~50 concrete facts grouped by topic
(`ST-400 'Cayman'`, `Art. 267 KK`, `61 000 rozwodów w 2021`). We have the raw
material — `score_data.competitor_claims` (per-URL sentences) and
`knowledge_graph.claims` (68, but every `cluster: "Unassigned"`) — and never
render it as a fact sheet. Per-section evidence exists; the global fact list does
not, and clustering is broken.

**Change.**
- Fix cluster assignment: claims get their topicBlock's title (they already share
  extraction), instead of the "Unassigned" literal.
- `briefWriter.ts`: new fenced `FACTS — use where relevant:` block in the user
  prompt, grouped by cluster, capped (~30 facts × 20 words); instruction: weave
  numbered/named facts into matching sections, never invent figures.
- Compiled plan already resolves claim IDs per paragraph (`_resolved`) — no
  sidecar change.

**Verify.** Prompt test: FACTS block grouped and fenced. Live: article names at
least the statute, registry, and one figure per business section.

## Task 6 — Two correctness bugs

**6a. Directive leaked into prose.** Article contains "…są kluczowe.
**Następnie: definicja.**" — a narrative bridge hint copied verbatim.
- Strip bridge/meta lines (`Następnie:`, `Bridge:`, `Wpleć frazy:`) from what
  enters the sidecar writer context (they are for the reviewer, not the writer),
  keeping them in the review outline UI.
- `postWriteValidators`: flag paragraphs matching directive patterns so a leak
  fails review instead of shipping.

**6b. Competitor brand as our lead subject.** First sentence: "Agencja
Detektywistyczna Ochrony Biznesu ds. zapewnia…" — a truncated brand heading from
expertus.pl that survived claim extraction (seed token "detektywistyczna" was
enough) and became the intro's subject.
- `corpusClaims.ts`: a sentence fragment that is brand-shaped (≥2 capitalised
  tokens beyond position 0, no assertive verb, or ends mid-abbreviation "ds.")
  is not a claim — extend the guard next to `namesAnotherBrand`'s logic.
- `section_writer.py` rules: competitor names in context are references, never
  the subject of our sentences.

**Verify.** Red-then-green tests: the exact leaked sentence and the exact brand
fragment from the report. Live: fresh lead names ProDetektyw, no directives.

---

## Verification prerequisites

DB was purged (account deletion) — nothing to measure against until one fresh
deep analysis runs for "prywatny detektyw warszawa" (user, via UI). Then each
task verifies with scratch scripts against the live row + one full generation at
the end, exported as a developer report and diffed against this baseline:

```
AI 15 → target ≥ 85     overall 57 → target ≥ 90
headings 8 → 23–28      paragraphs 21 → 55–66
li 0 → >0               table 0 → ≥1
terms 16 → ≥50          covered 6/16 → ≥13/16
```

---

# Appendix — Surfer's score architecture (reverse-engineered 2026-08-08)

Sources: `Desktop/sources/app.surferseo.com` bundle dump + `surferseonetworkhar.txt`.
The scorer is **client-side Rust/WASM** (`static/index_bg.*.wasm`, 24 MB debug build
with symbol names intact), exports `score(content, guidelines, version)` and
`get_score_current_version` (= 7). Recomputed in the browser on every edit.

## Pipeline

1. **Content model from the DOM** (`CKtw-LYT2.js`, fn `hd`): words via
   `Intl.Segmenter`, headings excluding link-only/`li,td,th`-nested ones, `p`
   count with the same exclusions, images `>100×100px` with alt/title,
   `first_100_words_excluding_h1`, `text_content_above_the_fold_excluding_h1`,
   `strong_or_bold_words`, `hidden_content_exists` (hidden text ratio > 5%).
2. **Guidelines from GraphQL** (`contentScoreGuidelines`, JSON string):
   - `query_words: [["detektywi","kraków"]]`
   - `structure`: `text_length` (chars), `paragraphs_quantity`,
     `headings_quantity`, `images_quantity` — each as TWO intervals
     (soft with overhead margins + hard), scored via `bounds.rs`
     `min_overhead`/`max_overhead`.
   - `terms.terms_to_use`: ~157 per keyword, each
     `{term_words, term_words_regexps, lemma_group_id, relevance, is_nlp, heading}`.
     **Matching is by full Polish-inflection regexps** —
     `usłu(?:g(?:a(?:ch|mi)|om|[iéę])...)` — one lemma group counts all forms as
     one term. 12/157 carry `heading: true` (expected in headings).
3. **WASM score groups** (v7 modules: `headings.rs`, `structure.rs`, `terms.rs`;
   components from data segments):
   - `structure`: text_length, paragraphs_quantity, headings_quantity, images_quantity
   - `headings`: query_words_in_h1, query_word_h2_h3, h2_to_h6 exact/partial
     density+ratios, h2_to_h6_bolds_partial_keywords, main_query_above_the_fold
   - `terms` (prominent): exact_density, query_words_density,
     partial_query_words_density, exact_or_query_word_in_first_100_words,
     true_density_phrases_coverage, split **top_20 / rest_60** by relevance
   - `nlp_terms`: phrases coverage + coverage in headings
   - images: at_least_one, proper_quantity, query word in alts/titles,
     main_query_in_image_alt
4. **Display**: `min(ceil(value), 100)`; per-group breakdown redistributes the
   rounding remainder onto the group with the largest max.

## What this changes in our plan

- **Task 4 (terms)**: the 81-term UI list is by design (top_20 + rest_60); the
  scorer gets ~157. Matching must be lemma-based, not exact-string — our
  `countOccurrences` misses most Polish inflections, and our list double-counts
  variants Surfer folds into one lemma group. The sidecar already produces terms;
  add per-word inflection regexps (or a stemmer) + lemma-group dedupe.
- **Task 3 (format)**: heading terms are explicit (`heading: true`) — the brief
  should route those into H2/H3 text, mirroring `query_word_h2_h3` and
  h2_to_h6 density components.
- Structure ranges as soft+hard intervals with overhead margins is a better
  scoring shape than our single target number — worth adopting in
  `contentScore.ts` when touching term scoring.
