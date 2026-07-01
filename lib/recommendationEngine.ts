// lib/recommendationEngine.ts
// Deterministic (no-LLM) recommendation model: Guideline/GuidelineGroup types,
// buildInstruction (checklist-style instruction synthesis), and effortOf (effort heuristic).
import type { CoverageItem, CoverageType, Importance } from './aiCoverage';
import type { ArticleContext } from './articleContext';

export type GuidelineGroupKey = 'intent' | 'knowledge' | 'authority' | 'quality' | 'structure';
export type GuidelineEffort = 'Easy' | 'Medium' | 'Large';

export interface Guideline {
  id: string;
  coverageItemId: string;
  group: GuidelineGroupKey;
  title: string;
  instruction: string;
  importance: Importance;
  status: 'open' | 'applied' | 'dismissed';
  projectedLift: number;
  effort: GuidelineEffort;
  easyWin: boolean;
  sectionId?: string;
}

export interface GuidelineGroup {
  key: GuidelineGroupKey;
  label: string;
  score: number;
  guidelines: Guideline[];
  covered: number;
  total: number;
}

/** needsExpansion, or more than 5 missing items → Large; 3-5 → Medium; else Easy. */
export function effortOf(item: CoverageItem): GuidelineEffort {
  const n = item.missing?.length ?? 0;
  if (item.needsExpansion || n > 5) return 'Large';
  if (n >= 3) return 'Medium';
  return 'Easy';
}

const bullets = (xs?: readonly string[]) => (xs && xs.length ? xs.map((m) => `• ${m}`).join('\n') : '');

type TemplateFn = (item: CoverageItem, context?: ArticleContext) => { title: string; instruction: string };

const fallbackTemplate: TemplateFn = (item) => ({
  title: item.label,
  instruction: item.reason || bullets(item.missing) || `Review and improve **${item.label}** to strengthen AI search coverage.`,
});

const intentTemplate: TemplateFn = (item, context) => {
  const keyword = context?.keyword;
  const title = 'Answer the main question early';
  const subject = keyword ? `**${keyword}**` : 'the main question';
  const reasonSuffix = item.reason ? ` — currently: ${item.reason}` : '';
  return {
    title,
    instruction: `Rewrite the first paragraph to directly answer ${subject}${reasonSuffix}.`,
  };
};

const knowledgeTemplate: TemplateFn = (item) => {
  if (item.needsExpansion) {
    const reasonSuffix = item.reason ? ` — ${item.reason}` : '';
    const checklist = bullets(item.missing);
    const stillMissing = checklist ? ` Still missing:\n${checklist}` : '';
    return {
      title: `Expand: ${item.label}`,
      instruction: `Deepen **${item.label}**${reasonSuffix}.${stillMissing}`,
    };
  }
  if (item.missing && item.missing.length) {
    return {
      title: `Cover: ${item.label}`,
      instruction: `Add a section covering **${item.label}**. Include:\n${bullets(item.missing)}`,
    };
  }
  return fallbackTemplate(item);
};

const entityTemplate: TemplateFn = (item) => ({
  title: `Use the term: ${item.label}`,
  instruction: `Work the term **${item.label}** into the copy naturally where relevant.`,
});

const readabilityTemplate: TemplateFn = (item) => ({
  title: item.label,
  instruction: item.reason || bullets(item.missing) || `Improve **${item.label}** for readability.`,
});

const authorityTemplate: TemplateFn = (item) => ({
  title: `Add ${item.label}`,
  instruction: `Cite ${item.label} (statistic / source / example) to strengthen credibility.`,
});

// Record<CoverageType, TemplateFn> so new CoverageType members (e.g. future E types) are forced to
// be wired in here; a category-level fallback within each template keeps behavior never-blank.
const templates: Record<CoverageType, TemplateFn> = {
  paa: knowledgeTemplate,
  fact: knowledgeTemplate,
  definition: knowledgeTemplate,
  comparison: knowledgeTemplate,
  example: knowledgeTemplate,
  process: knowledgeTemplate,
  statistic: knowledgeTemplate,
  expectation: knowledgeTemplate,
  warning: knowledgeTemplate,
  entity: entityTemplate,
  readability: readabilityTemplate,
  structure: fallbackTemplate,
  intent: intentTemplate,
};

export function buildInstruction(item: CoverageItem, context?: ArticleContext): { title: string; instruction: string } {
  // 'authority' is a CoverageCategory (not yet a CoverageType — its items land in E), so it is
  // dispatched on category ahead of the type-keyed Record.
  if (item.category === 'authority') return authorityTemplate(item, context);
  const template = templates[item.type];
  const result = template ? template(item, context) : fallbackTemplate(item);
  if (!result.instruction) return fallbackTemplate(item);
  return result;
}
