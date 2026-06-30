# Coverage-Engine Architecture Audit — Brief for a Fresh Session

**Repo:** `C:\Users\patry\Desktop\serpbear` (Next.js pages + TypeScript SEO content editor, SurferSEO clone).
**Branch:** `feature/gsap-motion-polish`.

Paste the brief below verbatim as the first user message of a fresh Claude Code session. It is self-contained — no prior context needed.

---

## Audit brief (paste this)

I want a **read-only architecture audit** of this repo to answer one central question:

> **Can the current architecture support a single shared "Coverage Engine" that powers SEO Score, AI Search, Content Score, Auto-Optimize, Outline, and AI Readability?**

**Hard rules:**
- DO NOT edit, write, or create any source files. DO NOT run mutating commands. No `git commit`, no `npm install`, no migrations.
- It is OK to create the final report file at the path I specify at the end.
- Use Read/Grep/Glob/Bash for inspection only.
- Cite findings with `file:line` references — no vague claims.

### Context (Surfer's December 2025 direction)

- Content Score = SEO + AI Search on the **same bar** (split), not two scores.
- **AI Search Guidelines** are a peer of **SEO Guidelines** (panel layout `Content Score → SEO Guidelines + AI Search Guidelines`).
- **Auto-Optimize has a decision engine / planner** — it knows when SEO is already strong and shifts to AI Search instead of piling on more entities. The LLM does NOT receive every recommendation; a planner first picks the subset that will actually move the score.
- **AI Search = citation _probability_** (LLM judges citability), not actual citations (that's the AI Tracker).
- **Guidelines = "information to add"** (knowledge gaps phrased as tasks), not keywords/entities.
- **Intro is a separate signal** — Intent Alignment evaluates the first ~500 words on its own.
- **AI Readability ≠ AI Search** — it's a Pre-Publish Review module (structure/formatting/scannability).
- **Outline uses the full context** — SERP, entities, AI-search requirements, brand voice, custom rules.
- The end-state model is a single `CoverageItem` (`type: paa | intent | fact | definition | comparison | example | warning | entity | process | statistic | expectation | structure | readability`, `importance: critical | recommended | optional`, `source: serp | competitors | paa | llm | manual`, `covered`, `quality 0-5`, `needsExpansion`, `sectionId?`).

### Background reading (read these first, in order)

1. `docs/superpowers/specs/2026-06-30-ai-search-coverage-model-design.md` — the AI-search coverage spec
2. `docs/superpowers/plans/2026-06-30-ai-search-coverage-model.md` — its implementation plan (not yet executed)
3. `docs/motion-guidelines.md` — style/runtime conventions

### Audit scope (10 sections — answer each)

For every section: give findings, file:line refs, then a clear verdict.

**1. CONTENT SCORE / SCORING PIPELINE**
- Find every place computing SEO score, Content Score, AI Search score (`lib/contentScore.ts`, `lib/aiSearchScore.ts`, `lib/aiCoverage.ts` if present, `components/articles/ScoreTrio.tsx`, `ScoreGauge.tsx`, `ContentScorePanel.tsx`, `pages/articles/[id]/index.tsx`).
- Is there ONE unified pipeline or scattered ad-hoc calls?
- Is "Content Score" just SEO, or a real SEO+AI blend? Show the blend formula if any.
- Could AI Search become a first-class coverage-based score without rewriting? What changes?
- Produce a dependency map (file → computes → consumers).

**2. SEO GUIDELINES**
- Locate terms / entities / missing keywords / NLP / SERP coverage logic (`lib/contentScore.ts`, `lib/seo/keywordData.ts`, `article_terms` in `lib/ensureArticlesTables.ts`, `ScoreData.terms`, `WriteOptimizePanel.tsx`).
- How are guidelines generated (DataForSEO? SERP? competitors? sidecar)?
- List ALL current guideline/term types + their data shape.
- Can new guideline types be added without refactor?

**3. AI SEARCH**
- Files: `lib/aiSearchScore.ts`, `lib/aiVisibilityStore.ts`, `pages/api/articles/ai-visibility.ts`, `components/articles/AiSearchPanel.tsx`, PAA in `lib/seo/keywordData.ts`, `lib/aiCoverage.ts` if present.
- Is AI Search KEYWORD/citation-based or INFORMATION/coverage-based TODAY?
- What does it depend on (entities, terms, sections, deepseek, embeddings, prompts, DataForSEO)?
- Where would a coverage-based AI Search plug into the existing flow?

**4. INTRO / INTENT ALIGNMENT**
- Does any code analyze the introduction independently? (`lib/articleSections.ts`, first-paragraph handling, "answersMainQuestionEarly" in `lib/aiCoverage.ts` if present.)
- Could an `IntroductionAnalyzer` (returning `intentConfirmed`, `audienceMentioned`, `goalMentioned`, `keywordVisible`, `answerStartsEarly`) be added without refactor?

**5. AI READABILITY**
- Where are headings / paragraphs / bullet lists / tables / formatting / readability already measured? (heading & paragraph counts in `lib/contentScore.ts`, pre-publish review components, plagiarism/readability panels.)
- Could these become a standalone `AI Readability` module?

**6. OUTLINE GENERATION**
- Find the outline generator (`components/articles/ResearchOutlinePanel.tsx`, `CompetitorOutlinesPanel.tsx`, any generate/outline endpoints, `brand_knowledge` / `site_context` usage).
- What data does it receive — SERP? entities? competitors? AI-search info? brand voice / custom rules?
- Raw prompt or pre-assembled context?
- Could it produce Surfer-style "ready-to-use briefs" without architectural change?

**7. AUTO-OPTIMIZE — incl. PLANNER question**
- Files: `pages/api/articles/optimize-sections.ts`, `components/articles/ContentOptimizerNodeView.tsx`, `optimizeStore.ts`, `lib/articleSections.ts`, `lib/optimizeReviewDoc.ts`.
- How are per-section prompts built? Do they already receive SEO entities/terms AND any AI-search/coverage info — or just one?
- How are sections split (H2? paragraph cap?)?
- **Decision engine / planner:** Is there ANY layer between recommendations and the LLM prompt that decides which guidelines to apply (e.g. "SEO strong → skip entities, focus on AI")? Or does the prompt receive all recommendations at once?
- Where would an `OptimizationPlanner` plug in (input = SEO/AI scores + open recommendations; output = a small ordered subset)?

**8. KNOWLEDGE MODEL**
- Does a reusable model representing coverage / guidelines / facts / entities / recommendations already exist? (`ScoreData.terms`, `lib/optimizeStats.ts`, recommendations rows, `lib/aiCoverage.ts` if present.)
- List each model's shape + where it lives.
- Identify whether multiple independent models exist that could merge into ONE shared `CoverageItem` (`id, type, importance, source, covered, quality, sectionId, label, needsExpansion, missing[]`).

**9. EXTENSIBILITY**
- How hard is it (Low / Medium / High) to introduce, without major refactor:
  Intent Alignment · AI Search Guidelines · Facts · AI Readability · Knowledge Coverage · Coverage Quality · Missing Information · Section Coverage · Optimization Planner.

**10. FINAL REPORT — produce all of:**
1. Direct answer to the central question (yes / partially / no, with reasoning).
2. **Current architecture diagram** (ASCII or Mermaid).
3. **Recommended Coverage-Engine architecture diagram** (ASCII or Mermaid).
4. Mapping: which existing modules become the **foundation** of the Coverage Engine (keep), which **adapt**, which **deprecate**.
5. Top 5 strengths of the current architecture.
6. Top 5 weaknesses / technical debt.
7. Concrete plug-in points for: `CoverageItem` model · `OptimizationPlanner` · `IntroductionAnalyzer` · `AI Readability` analyzer.
8. Refactor effort estimate per move (Low / Medium / High).
9. Risks + recommended order of execution (which sub-projects first, dependencies).

### Output

Write the final report to:
`docs/superpowers/specs/2026-06-30-coverage-engine-audit.md`

This is the **only** file you may create. Do not modify any source.

### How to work

- Use 4 parallel `Plan` subagents (read-only by tool whitelist) for sections 1–7 to save context, then synthesize sections 8–10 yourself.
- Cite `file:line` for every finding. No vague claims.
- If something can't be determined from the code, say so explicitly — don't guess.
