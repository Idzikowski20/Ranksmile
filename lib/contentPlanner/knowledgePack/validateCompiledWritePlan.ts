import type { CompiledWritePlan, PackValidationResult } from './types';
import { validateRuntime } from './validateRuntime';
import { validateSemantic } from './validateSemantic';
import { validateStructural } from './validateStructural';

// eslint-disable-next-line import/prefer-default-export
export function validateCompiledWritePlan(plan: CompiledWritePlan): PackValidationResult {
  const issues = [
    ...validateStructural(plan).issues,
    ...validateSemantic(plan).issues,
    ...validateRuntime(plan).issues,
  ];

  return { ok: issues.length === 0, issues };
}
