/**
 * Override execution-plan section headings with user-approved outline (TipTap Hn).
 */
import type {
  ArticleExecutionPlan,
  ExecutionPlanSection,
} from './types';
import { hashExecutionPlanPayload } from './executionPlan';

export type ApprovedOutlineHeading = {
  level: number;
  text: string;
};

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
    }))
    .filter((h) => h.text.length > 0);
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

/** Rebuild plan sections from approved Hn; keep planner briefs by index when present. */
export function applyApprovedOutlineToPlan(
  plan: ArticleExecutionPlan,
  approved: ApprovedOutlineHeading[],
): ArticleExecutionPlan {
  const headings = normalizeHeadings(approved);
  if (!headings.length) return plan;

  const body = headings.filter((h) => h.level >= 2);
  const use = body.length > 0 ? body : headings;
  if (use.length !== plan.sections.length) return plan;
  const template = plan.sections[0];

  const sections: ExecutionPlanSection[] = use.map((h, i) => {
    const base = plan.sections[i] ?? stubSection(i, template);
    return {
      ...base,
      id: base.id || `approved-${i}`,
      heading: h.text,
      objective: base.objective || `Write section: ${h.text}`,
      reason: {
        summary: `User-approved outline: ${h.text}`,
        signals: base.reason?.signals ?? [],
      },
    };
  });

  const h1 = headings.find((h) => h.level === 1);
  const { planHash: _drop, ...rest } = plan;
  const payload: Omit<ArticleExecutionPlan, 'planHash'> = {
    ...rest,
    title: h1?.text || plan.title,
    sections,
  };
  return { ...payload, planHash: hashExecutionPlanPayload(payload) };
}
