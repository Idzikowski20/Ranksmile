# Task 4 Report: Structural Validator for CompiledWritePlan

## Status
DONE

## Commits
- `feat(planner): structural validator` (65984d27)
  - Added `lib/contentPlanner/knowledgePack/validateStructural.ts`
  - Added `__tests__/lib/contentPlanner/validateStructural.test.ts`
  - Exported `validateStructural` from `lib/contentPlanner/index.ts`

## Tests
13 passed, 1 suite: `__tests__/lib/contentPlanner/validateStructural.test.ts`

Coverage includes: valid plan, missing paragraph refs, unresolved claim/fact/entity/source/question refs, fact claimId resolution, invalid claim status, missing dependency, empty pack/paragraph ids, and empty paragraphPlanIds.

## Concerns
- Full `tsc --noEmit` reports pre-existing errors in billing, subscription, intelligence, and dashboard files unrelated to this task. No errors originate from the new validator or its test.
- Task instructions did not ask for Semantic PR-B checks (cycle detection, coverage gaps, etc.) — they are intentionally excluded.

## Review Fix (empty-id continue skip)

### Finding
After pushing `empty_pack_id` / `empty_paragraph_id` issues, `validateStructural` used `continue` and skipped remaining structural checks for that pack/paragraph.

### Fix
- Removed both `continue` statements in `lib/contentPlanner/knowledgePack/validateStructural.ts` so empty-id issues are emitted alongside paragraphPlanIds, refs, and dependency checks.
- Added combined-invalid-input tests: empty pack id + missing paragraph ref; empty paragraph id + missing dependency + unresolved claim.

### Tests
```
npm test -- __tests__/lib/contentPlanner/validateStructural.test.ts
```
```
PASS __tests__/lib/contentPlanner/validateStructural.test.ts
  validateStructural
    √ returns ok for a valid plan
    √ errors when a pack references a missing paragraph plan
    √ errors when a paragraph has a claim ref that does not resolve in graph
    √ errors when a paragraph has a fact ref that does not resolve in graph
    √ errors when a paragraph has an entity ref that does not resolve in graph
    √ errors when a paragraph has a source ref that does not resolve in graph
    √ errors when a paragraph has a question ref that does not resolve in graph
    √ errors when a fact claimId does not resolve to a claim
    √ errors when a claim status is not a valid enum value
    √ errors when dependsOnParagraphs references a missing paragraph
    √ errors when a pack id is empty
    √ errors when a paragraph id is empty
    √ errors when a pack has empty paragraphPlanIds
    √ reports empty pack id and missing paragraph ref together
    √ reports empty paragraph id and unresolved refs together

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```
