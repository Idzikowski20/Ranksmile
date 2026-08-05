import type {
  CompiledWritePlan,
  PackValidationIssue,
  PackValidationResult,
  PipelineManifest,
} from './types';

const GRAPH_ARRAYS = ['sources', 'entities', 'claims', 'facts', 'questions'] as const;
const MANIFEST_FIELDS: Array<keyof PipelineManifest> = [
  'plannerVersion',
  'compilerVersion',
  'validatorVersion',
  'writerVersion',
  'judgeVersion',
  'rendererVersion',
  'compiledAt',
];

function issue(
  code: string,
  message: string,
  packId?: string,
  paragraphId?: string,
): PackValidationIssue {
  return { stage: 'runtime', code, message, packId, paragraphId };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Keep validator exports consistent for staged composition in validateCompiledWritePlan.
// eslint-disable-next-line import/prefer-default-export
export function validateRuntime(plan: CompiledWritePlan): PackValidationResult {
  const issues: PackValidationIssue[] = [];

  for (const field of GRAPH_ARRAYS) {
    if (!Array.isArray(plan.graph?.[field])) {
      issues.push(issue('missing_graph_array', `Graph field "${field}" must be an array`));
    }
  }

  const packs = Array.isArray(plan.knowledgePacks) ? plan.knowledgePacks : [];
  const paragraphs = Array.isArray(plan.paragraphPlans) ? plan.paragraphPlans : [];
  if (packs.length > 0 && paragraphs.length === 0) {
    issues.push(issue('empty_paragraph_registry', 'Writer requires paragraphs when knowledge packs exist'));
  }

  const paragraphIds = new Set(paragraphs.map((paragraph) => paragraph.id));
  for (const pack of packs) {
    for (const paragraphId of pack.paragraphPlanIds ?? []) {
      if (!paragraphIds.has(paragraphId)) {
        issues.push(
          issue(
            'paragraph_not_loadable',
            `Pack "${pack.id}" paragraph "${paragraphId}" is not loadable from the registry`,
            pack.id,
            paragraphId,
          ),
        );
      }
    }
  }

  for (const field of MANIFEST_FIELDS) {
    if (!isNonEmptyString(plan.manifest?.[field])) {
      issues.push(issue('invalid_manifest_field', `Manifest field "${field}" must be a non-empty string`));
    }
  }

  if (!isNonEmptyString(plan.title)) {
    issues.push(issue('missing_title', 'Writer requires a non-empty title'));
  }
  if (!isNonEmptyString(plan.keyword)) {
    issues.push(issue('missing_keyword', 'Writer requires a non-empty keyword'));
  }

  if (plan.coverageGaps !== undefined) {
    if (!Array.isArray(plan.coverageGaps)) {
      issues.push(issue('invalid_coverage_gap', 'coverageGaps must be an array'));
    } else {
      plan.coverageGaps.forEach((gap, index) => {
        if (
          !isNonEmptyString(gap?.text)
          || !isNonEmptyString(gap?.importance)
          || typeof gap?.covered !== 'boolean'
        ) {
          issues.push(issue('invalid_coverage_gap', `Coverage gap at index ${index} has an invalid shape`));
        }
      });
    }
  }

  return { ok: issues.length === 0, issues };
}
