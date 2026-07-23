import type { Action, Observation } from '../primitives/types';

function liftFromSeverity(severity?: Observation['severity']): number {
  if (severity === 'high') return 12;
  if (severity === 'medium') return 7;
  return 4;
}

function costFromSeverity(severity?: Observation['severity']): Action['cost'] {
  if (severity === 'high') return 'large';
  if (severity === 'medium') return 'medium';
  return 'easy';
}

/**
 * Turn platform Observations (GSC / Audit / AI Vis / …) into Action[].
 * Coverage gaps already become Actions via Feature Engine — this covers the rest.
 */
export function actionsFromObservations(observations: readonly Observation[]): Action[] {
  const out: Action[] = [];
  for (const o of observations) {
    if (o.kind === 'low_ctr') {
      out.push({
        id: `act-${o.id}`,
        type: 'rewrite_section',
        title: o.title.startsWith('Low CTR') ? `Improve CTR: ${o.title.replace(/^Low CTR:\s*/i, '')}` : o.title,
        instruction:
          o.detail ||
          'Rewrite title/meta and strengthen the opening to improve click-through from search.',
        expectedLift: liftFromSeverity(o.severity),
        confidence: o.confidence ?? 0.65,
        cost: costFromSeverity(o.severity),
        difficulty: o.severity === 'high' ? 'hard' : 'moderate',
        impact: o.severity === 'high' ? 'high' : 'medium',
        reason: o.detail || o.title,
        origin: 'performance',
        appliesTo: { kind: 'article', id: o.articleId != null ? String(o.articleId) : undefined },
        generatedBy: 'actionsFromObservations',
        featureId: 'gsc',
        observationIds: [o.id],
        relatedTopics: o.relatedTopicIds,
      });
      continue;
    }
    if (o.kind === 'audit_issue') {
      out.push({
        id: `act-${o.id}`,
        type: 'custom',
        title: o.title.replace(/^[^:]+:\s*/i, 'Fix: '),
        instruction: o.detail || `Resolve audit issue: ${o.title}`,
        expectedLift: liftFromSeverity(o.severity),
        confidence: o.confidence ?? 0.7,
        cost: costFromSeverity(o.severity),
        reason: o.detail || o.title,
        origin: 'audit',
        appliesTo: { kind: 'domain', id: o.domainId != null ? String(o.domainId) : undefined },
        generatedBy: 'actionsFromObservations',
        featureId: 'audit',
        observationIds: [o.id],
        evidence: o.payload?.issueId
          ? [{ url: typeof o.payload.issueId === 'string' ? o.payload.issueId : undefined }]
          : undefined,
        relatedEntities: typeof o.payload?.issueId === 'string' ? [o.payload.issueId] : undefined,
      });
      continue;
    }
    if (o.kind === 'visibility_drop') {
      out.push({
        id: `act-${o.id}`,
        type: 'cover_question',
        title: 'Recover AI Visibility',
        instruction:
          o.detail ||
          'Cover prompts where visibility dropped — strengthen answers and citations for AI search.',
        expectedLift: Math.max(8, Math.abs(Math.round(o.score ?? 10))),
        confidence: o.confidence ?? 0.7,
        cost: 'medium',
        impact: 'high',
        reason: o.title,
        origin: 'visibility',
        appliesTo: { kind: 'domain', id: o.domainId != null ? String(o.domainId) : undefined },
        generatedBy: 'actionsFromObservations',
        featureId: 'visibility',
        observationIds: [o.id],
      });
      continue;
    }
    if (o.kind === 'missing_faq' || o.kind === 'missing_topic' || o.kind === 'coverage_gap') {
      // Usually already covered by Coverage Feature; keep only if no duplicate id path.
      out.push({
        id: `act-${o.id}`,
        type: o.kind === 'missing_faq' ? 'add_faq' : 'cover_question',
        title: o.title,
        instruction: o.detail || `Cover: ${o.title}`,
        expectedLift: liftFromSeverity(o.severity),
        confidence: o.confidence ?? 0.75,
        cost: 'easy',
        reason: o.detail || o.title,
        origin: 'coverage',
        appliesTo: { kind: 'article', id: o.articleId != null ? String(o.articleId) : undefined },
        generatedBy: 'actionsFromObservations',
        featureId: 'coverage',
        observationIds: [o.id],
        relatedQuestions: o.relatedQuestionIds,
      });
    }
  }
  return out;
}

export function isLlmAction(action: Action): boolean {
  return ['rewrite_section', 'expand_section', 'add_faq', 'cover_question', 'fix_heading', 'create_outline'].includes(
    String(action.type),
  );
}
