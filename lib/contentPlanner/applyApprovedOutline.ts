/**
 * Override execution-plan section headings with user-approved outline (TipTap Hn).
 *
 * The reviewer may add, drop or reorder H2s and nest H3/H4 under them — the plan
 * follows the approved structure. Knowledge from dropped sections is merged into
 * the last kept section so Plan Validator coverage is never silently lost.
 */
import type {
  ArticleExecutionPlan,
  ExecutionPlanClaim,
  ExecutionPlanSection,
} from './types';
import { hashExecutionPlanPayload } from './executionPlan';

export type ApprovedOutlineHeading = {
  level: number;
  text: string;
  instructions?: string[];
  targetWords?: number;
};

export function parseApprovedOutline(raw: unknown): ApprovedOutlineHeading[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const value = item as Record<string, unknown>;
    const text = typeof value.text === 'string' ? value.text.trim() : '';
    const level = typeof value.level === 'number' ? value.level : Number(value.level);
    if (!text || !Number.isFinite(level)) return [];
    const instructions = Array.isArray(value.instructions)
      ? value.instructions
        .filter((instruction): instruction is string => typeof instruction === 'string')
        .map((instruction) => instruction.trim())
        .filter(Boolean)
      : [];
    const targetWords = typeof value.targetWords === 'number'
      && Number.isInteger(value.targetWords)
      && value.targetWords > 0
      ? value.targetWords
      : undefined;
    return [{
      level,
      text,
      ...(instructions.length ? { instructions } : {}),
      ...(targetWords ? { targetWords } : {}),
    }];
  });
}

const DEFAULT_BUDGET = {
  words: 300,
  claims: 0,
  entities: 1,
  questions: 0,
  examples: 0,
  lists: 0,
  tables: 0,
  images: 0,
  faq: 0,
  citations: 0,
} as const;

function normalizeHeadings(approved: ApprovedOutlineHeading[]): ApprovedOutlineHeading[] {
  return approved
    .map((h) => ({
      level: Math.min(Math.max(Number(h.level) || 2, 1), 4),
      text: String(h.text || '').trim(),
      instructions: Array.isArray(h.instructions)
        ? h.instructions.map((item) => String(item).trim()).filter(Boolean)
        : undefined,
      targetWords: Number.isFinite(Number(h.targetWords))
        ? Math.min(2000, Math.max(80, Math.round(Number(h.targetWords))))
        : undefined,
    }))
    .filter((h) => h.text.length > 0);
}

/** One approved H2 plus the H3/H4 the reviewer nested under it. */
type OutlineGroup = {
  heading: ApprovedOutlineHeading;
  subheadings: ApprovedOutlineHeading[];
};

function groupHeadings(headings: ApprovedOutlineHeading[]): {
  title: string | null;
  groups: OutlineGroup[];
} {
  let title: string | null = null;
  const groups: OutlineGroup[] = [];
  for (const heading of headings) {
    if (heading.level <= 1) {
      title = title ?? heading.text;
      continue;
    }
    // H3/H4 before any H2 has nothing to nest under — promote it to a section.
    if (heading.level === 2 || groups.length === 0) {
      groups.push({ heading, subheadings: [] });
      continue;
    }
    groups[groups.length - 1].subheadings.push(heading);
  }
  return { title, groups };
}

/** Sub-headings become writer instructions so H3 detail survives without inflating sections. */
function groupInstructions(group: OutlineGroup): string[] {
  const lines = [...(group.heading.instructions ?? [])];
  for (const sub of group.subheadings) {
    lines.push(`H${sub.level}: ${sub.text}`);
    for (const instruction of sub.instructions ?? []) {
      lines.push(`- ${instruction}`);
    }
  }
  return lines;
}

function groupTargetWords(group: OutlineGroup): number | undefined {
  if (group.heading.targetWords) return group.heading.targetWords;
  const nested = group.subheadings.reduce((total, sub) => total + (sub.targetWords ?? 0), 0);
  return nested > 0 ? nested : undefined;
}

function stubSection(i: number, template: ExecutionPlanSection | undefined): ExecutionPlanSection {
  return {
    id: `approved-${i}`,
    heading: '',
    objective: 'Cover this section thoroughly',
    priority: 'high',
    expectedWords: template?.expectedWords ?? 300,
    claims: [],
    entities: template?.entities?.slice(0, 2) ?? [],
    questions: [],
    mustAnswer: [],
    evidence: [],
    blocks: template?.blocks?.length ? [...template.blocks] : ['summary'],
    budget: template?.budget ? { ...template.budget } : { ...DEFAULT_BUDGET },
    writerHints: template?.writerHints
      ? { ...template.writerHints }
      : {
          previousSection: null,
          nextSection: null,
          transition: '',
          tone: 'practical',
          avoidRepeating: [],
        },
    reason: { summary: 'User-approved outline heading', signals: [] },
  };
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function uniqueClaims(claims: ExecutionPlanClaim[]): ExecutionPlanClaim[] {
  const byId = new Map<string, ExecutionPlanClaim>();
  for (const claim of claims) {
    if (!byId.has(claim.id)) byId.set(claim.id, claim);
  }
  return [...byId.values()];
}

/** Fold knowledge from sections the reviewer deleted into the last kept section. */
function absorbDropped(
  section: ExecutionPlanSection,
  dropped: ExecutionPlanSection[],
): ExecutionPlanSection {
  if (!dropped.length) return section;
  return {
    ...section,
    claims: uniqueClaims([...section.claims, ...dropped.flatMap((item) => item.claims)]),
    entities: uniqueStrings([...section.entities, ...dropped.flatMap((item) => item.entities)]),
    questions: uniqueStrings([...section.questions, ...dropped.flatMap((item) => item.questions)]),
    mustAnswer: uniqueStrings([...section.mustAnswer, ...dropped.flatMap((item) => item.mustAnswer)]),
    evidence: [...section.evidence, ...dropped.flatMap((item) => item.evidence)],
  };
}

/**
 * Rebuild plan sections from the approved outline. Planner briefs are kept by index;
 * extra headings get a stub brief, removed ones donate their knowledge to the last section.
 * Returns null only when the outline carries no usable heading.
 */
export function applyApprovedOutlineToPlan(
  plan: ArticleExecutionPlan,
  approved: ApprovedOutlineHeading[],
): ArticleExecutionPlan | null {
  const headings = normalizeHeadings(approved);
  if (!headings.length) return plan;

  const { title, groups } = groupHeadings(headings);
  if (!groups.length) return null;

  const template = plan.sections[0];
  const hasReviewedTargets = groups.some((group) => groupTargetWords(group) !== undefined);

  const sections: ExecutionPlanSection[] = groups.map((group, i) => {
    const base = plan.sections[i] ?? stubSection(i, template);
    const instructions = groupInstructions(group);
    const targetWords = groupTargetWords(group);
    return {
      ...base,
      id: base.id || `approved-${i}`,
      heading: group.heading.text,
      objective: instructions.length
        ? instructions.join('\n')
        : (base.objective || `Write section: ${group.heading.text}`),
      expectedWords: targetWords ?? base.expectedWords,
      budget: targetWords ? { ...base.budget, words: targetWords } : base.budget,
      reason: {
        summary: `User-approved outline: ${group.heading.text}`,
        signals: base.reason?.signals ?? [],
      },
    };
  });

  const dropped = plan.sections.slice(groups.length);
  if (dropped.length) {
    sections[sections.length - 1] = absorbDropped(sections[sections.length - 1], dropped);
  }

  const reviewedWords = sections.reduce((total, section) => total + section.expectedWords, 0);
  const { planHash: _drop, ...rest } = plan;
  const payload: Omit<ArticleExecutionPlan, 'planHash'> = {
    ...rest,
    title: title || plan.title,
    articleBudget: {
      ...plan.articleBudget,
      words: hasReviewedTargets ? reviewedWords : plan.articleBudget.words,
      h2: sections.length,
    },
    sections,
  };
  return { ...payload, planHash: hashExecutionPlanPayload(payload) };
}

/**
 * Non-blocking review warnings — the reviewer owns the structure, but a plan that
 * undershoots the competitor benchmark should say so in the generate response.
 */
export function approvedOutlineWarnings(plan: ArticleExecutionPlan): string[] {
  const warnings: string[] = [];
  const words = plan.articleBudget.words;
  if (words < plan.benchmark.targetWords) {
    warnings.push(
      `Approved outline targets ${words} words, below the competitor benchmark of ${plan.benchmark.targetWords}.`,
    );
  }
  if (plan.sections.length < plan.benchmark.targetH2) {
    warnings.push(
      `Approved outline has ${plan.sections.length} sections, below the benchmark of ${plan.benchmark.targetH2}.`,
    );
  }
  return warnings;
}
