import type { CompiledWritePlan, PackValidationResult } from '@/src/infrastructure/contentPlanner/knowledgePack/types';
import { validateRuntime } from '@/src/infrastructure/contentPlanner/knowledgePack/validateRuntime';
import { validateSemantic } from '@/src/infrastructure/contentPlanner/knowledgePack/validateSemantic';
import { validateStructural } from '@/src/infrastructure/contentPlanner/knowledgePack/validateStructural';

// eslint-disable-next-line import/prefer-default-export
export function validateCompiledWritePlan(plan: CompiledWritePlan): PackValidationResult {
  const issues = [
    ...validateStructural(plan).issues,
    ...validateSemantic(plan).issues,
    ...validateRuntime(plan).issues,
  ];

  return { ok: issues.length === 0, issues };
}
