// lib/recommendationEngine.ts
// Deterministic (no-LLM) recommendation model: Guideline/GuidelineGroup types,
// buildInstruction (checklist-style instruction synthesis), and effortOf (effort heuristic).
import type { CoverageItem, CoverageSnapshot, CoverageType, Importance } from './aiCoverage';
import type { ArticleContext } from './articleContext';
import { scoreContribution } from './coverage/derived/scoreContribution';
import { isNewRecommendationsEnabled } from './featureFlags';

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

// Per-intent copy keyed on the fixed INTENT_ITEMS ids (lib/aiCoverage.ts). Without this every
// intent item rendered the "answer early" instruction, so expectations/who/why looked wrong.
const INTENT_INSTRUCTIONS: Record<string, (subject: string) => string> = {
  'intent-answer-main': (s) => `Make sure the article clearly and directly answers ${s}.`,
  'intent-answer-early': (s) => `Rewrite the first paragraph to directly answer ${s}.`,
  'intent-expectations': () => 'In the introduction, set expectations: tell the reader what the article covers and what they will take away.',
  'intent-who': () => "State early who this content is for, so the target reader immediately sees it's relevant to them.",
  'intent-why': (s) => `Explain why ${s} matters to the reader — the stakes, benefit, or payoff.`,
};

const intentTemplate: TemplateFn = (item, context) => {
  const keyword = context?.keyword;
  const reasonSuffix = item.reason ? ` — currently: ${item.reason}` : '';
  const citationStyle = isNewRecommendationsEnabled()
    || item.id.startsWith('intent-citation-')
    || (item.id.startsWith('citation-') && item.type === 'intent');
  if (citationStyle) {
    return {
      title: item.label,
      instruction: `Answer the user question "${item.label}" clearly in the article.${reasonSuffix}`,
    };
  }
  const build = INTENT_INSTRUCTIONS[item.id];
  if (build) {
    const subject = keyword ? `**${keyword}**` : 'the main question';
    return {
      title: item.label,
      instruction: `${build(subject)}${reasonSuffix}`,
    };
  }
  const checklist = bullets(item.missing);
  return {
    title: item.label,
    instruction: `Answer this AI search prompt clearly in the article: **${item.label}**${reasonSuffix}.${checklist ? `\nStill missing:\n${checklist}` : ''}`,
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

/** CoverageCategory → GuidelineGroupKey. `structure`-typed items are pulled out of `quality`
 *  into their own group so the UI can show structure issues separately. */
export function categoryToGroup(item: CoverageItem): GuidelineGroupKey {
  if (item.type === 'structure') return 'structure';
  switch (item.category) {
    case 'intent': return 'intent';
    case 'knowledge': return 'knowledge';
    case 'authority': return 'authority';
    default: return 'quality'; // 'quality' | 'style'
  }
}

/** An item is "fully covered" only when present AND graded well (quality>=4). Shallow/needs-expansion
 *  items (covered but low quality) are still actionable. Single source of truth so the guideline
 *  filter and the UI status dot cannot drift apart. */
export function isFullyCovered(item: CoverageItem): boolean {
  return item.covered && item.quality >= 4;
}

/** All snapshot items not already fully covered, turned into actionable Guidelines. */
export function buildGuidelines(snapshot: CoverageSnapshot, context?: ArticleContext): Guideline[] {
  return snapshot.items
    .filter((item) => !isFullyCovered(item))
    .map((item) => {
      const lift = scoreContribution(item, snapshot);
      return {
        id: `guideline-${item.id}`,
        coverageItemId: item.id,
        group: categoryToGroup(item),
        ...buildInstruction(item, context),
        importance: item.importance,
        status: 'open' as const,
        projectedLift: lift,
        effort: effortOf(item),
        easyWin: lift >= 8 && (item.missing?.length ?? 0) <= 2,
        sectionId: item.sectionId,
      };
    });
}

const GROUP_KEYS: GuidelineGroupKey[] = ['intent', 'knowledge', 'authority', 'quality', 'structure'];
const GROUP_LABEL: Record<GuidelineGroupKey, string> = {
  intent: 'Intent Alignment',
  knowledge: 'Knowledge Coverage',
  authority: 'Authority',
  quality: 'Content Quality',
  structure: 'Structure',
};
const IMPORTANCE_SORT_WEIGHT: Record<Importance, number> = { critical: 3, recommended: 2, optional: 1 };

/** GuidelineGroupKey → the snapshot bucket (CoverageCategory) it scores against.
 *  `structure` has no bucket of its own — it rides on the `quality` bucket. */
export function bucketForGroup(key: GuidelineGroupKey): CoverageItem['category'] {
  return key === 'structure' ? 'quality' : key;
}

/** Buckets guidelines into the 5 named groups (always all 5, even empty) with per-group bucket
 *  score + covered/total, and sorts each group's guidelines importance-first. */
export function groupGuidelines(guidelines: Guideline[], snapshot: CoverageSnapshot): GuidelineGroup[] {
  return GROUP_KEYS.map((key) => {
    const groupItems = snapshot.items.filter((item) => categoryToGroup(item) === key);
    const groupGuidelinesList = guidelines
      .filter((g) => g.group === key)
      .slice()
      .sort((a, b) => (
        IMPORTANCE_SORT_WEIGHT[b.importance] - IMPORTANCE_SORT_WEIGHT[a.importance]
        || b.projectedLift - a.projectedLift
        || (snapshot.items.find((it) => it.id === a.coverageItemId)?.quality ?? 0)
          - (snapshot.items.find((it) => it.id === b.coverageItemId)?.quality ?? 0)
        || a.title.localeCompare(b.title)
      ));
    return {
      key,
      label: GROUP_LABEL[key],
      score: snapshot.buckets.find((b) => b.key === bucketForGroup(key))?.score ?? 0,
      guidelines: groupGuidelinesList,
      covered: groupItems.filter((item) => item.covered).length,
      total: groupItems.length,
    };
  });
}
