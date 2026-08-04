# Task 6: Serialize + generate payload — Report

## Status

Completed. TDD serializer implemented; `generate.ts` now validates the compiled write plan and attaches it to the sidecar payload, returning 422 with diagnostics on structural failure.

## Commits

- `feat: generate sends validated compiled_write_plan + diagnostics`

## Files Added/Changed

- `lib/contentPlanner/knowledgePack/toSidecarCompiledPlan.ts` (new) — recursive camelCase → snake_case serializer.
- `__tests__/lib/contentPlanner/toSidecarCompiledPlan.test.ts` (new) — TDD serializer tests.
- `lib/contentPlanner/index.ts` — exports `toSidecarCompiledPlan`.
- `pages/api/articles/[id]/generate.ts` — calls `compileAndValidateWritePlan`, returns 422 on failure, adds `compiled_write_plan` and `diagnostics` to the sidecar payload and 202 response.

## One-line Tests

- `toSidecarCompiledPlan` snake_cases top-level keys (`plan_hash`, `knowledge_packs`, `paragraph_plans`, `quick_answer`).
- Nested knowledge pack keys are snake_cased (`paragraph_plan_ids`, `section_id`, `section_transitions`, `section_constraints`).
- Paragraph plan keys are snake_cased (`depends_on_paragraphs`, `keywords`, `actual_occurrences`, `preferred_paragraphs`, `min_occurrences`, `max_occurrences`).
- Graph, manifest, and diagnostics are recursively snake_cased (`created_at`, `research_version`, `planner_version`, `compiler_version`, `compiled_at`, `paragraph_count`, `pack_count`, `word_budget`, `coverage_pct`, `entity_coverage_pct`).
- Primitive values and arrays are preserved unchanged.
- Serializer round-trips through `JSON.stringify/parse` without losing snake_case shape.

## Verification

```bash
npx jest __tests__/lib/contentPlanner/toSidecarCompiledPlan.test.ts --ci
# 6 passed, 6 total

npx jest __tests__/lib/contentPlanner --ci
# 9 suites, 71 passed, 71 total
```

No linter errors in the new files. `pages/api/articles/[id]/generate.ts` still has four pre-existing lint errors unrelated to this change. Full-workspace `tsc --noEmit` still reports pre-existing errors in unrelated files; no new errors were introduced in the changed files.

## Concerns

- `importantTerms` is passed as `[]` because there is no ready NLP/score term list in `generate.ts`; the brief explicitly permits this fallback.
- `allowBrandNiche` is read from the local `generate.ts` variable (currently hardcoded to `false`), matching the existing planner invocation.
- Python Writer is not touched in this task.
- No persistent storage of the compiled plan was added; the compiled JSON is sent to the sidecar inline.
