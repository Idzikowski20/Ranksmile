import type { Guideline, GuidelineEffort } from '../recommendationEngine';
import type { Action, ActionCost, ActionType } from './types';

function effortToCost(effort: GuidelineEffort): ActionCost {
  if (effort === 'Easy') return 'easy';
  if (effort === 'Medium') return 'medium';
  return 'large';
}

function inferActionType(g: Guideline): ActionType {
  const t = `${g.title} ${g.group}`.toLowerCase();
  if (t.includes('faq') || g.group === 'intent') return 'cover_question';
  if (t.includes('expand') || g.effort === 'Large') return 'expand_section';
  if (g.group === 'structure') return 'fix_heading';
  if (g.group === 'knowledge' || g.group === 'authority') return 'rewrite_section';
  return 'custom';
}

/** Bridge: existing Guideline → universal Action (transition until Coverage Feature owns this). */
export function guidelineToAction(
  g: Guideline,
  opts?: { articleId?: string; featureId?: string; observationIds?: string[] },
): Action {
  const cost = effortToCost(g.effort);
  return {
    id: g.id,
    type: inferActionType(g),
    title: g.title,
    instruction: g.instruction,
    expectedLift: g.projectedLift,
    confidence: g.easyWin ? 0.9 : g.importance === 'critical' ? 0.85 : 0.7,
    cost,
    difficulty: cost === 'easy' ? 'trivial' : cost === 'medium' ? 'moderate' : 'hard',
    impact: g.projectedLift >= 10 ? 'high' : g.projectedLift >= 5 ? 'medium' : 'low',
    priority: Math.round(g.projectedLift * 10),
    reason: g.instruction,
    origin: 'coverage',
    appliesTo: {
      kind: g.sectionId ? 'section' : 'article',
      id: g.sectionId || opts?.articleId,
    },
    requires: g.sectionId ? undefined : ['outline.exists'],
    dependsOn: [],
    generatedBy: 'recommendationEngine.buildGuidelines',
    featureId: opts?.featureId || 'coverage',
    observationIds: opts?.observationIds,
    evidence: [],
    relatedTopics: g.group ? [g.group] : [],
    relatedQuestions: g.coverageItemId ? [g.coverageItemId] : [],
    relatedEntities: [],
  };
}

export function guidelinesToActions(
  guidelines: readonly Guideline[],
  opts?: { articleId?: string; featureId?: string; observationIds?: string[] },
): Action[] {
  return guidelines.map((g) => guidelineToAction(g, opts));
}
