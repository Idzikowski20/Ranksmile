import type { Action } from '../primitives/types';
import { isLlmAction } from './actionsFromObservations';

export type OptimizeActionScope = {
  mode: 'full' | 'faq_only' | 'action';
  questionIds?: string[];
  instruction?: string;
};

/** Map Priority Action → surgical optimize-sections scope. */
export function scopeFromAction(action: Action): OptimizeActionScope | null {
  if (!isLlmAction(action)) return null;
  if (action.type === 'add_faq' || action.type === 'cover_question') {
    return {
      mode: 'faq_only',
      questionIds: action.relatedQuestions?.length ? action.relatedQuestions : undefined,
      instruction: action.instruction,
    };
  }
  return {
    mode: 'action',
    instruction: action.instruction || action.title,
  };
}

export function auditIssueIdFromAction(action: Action): string | null {
  if (action.origin !== 'audit' && action.featureId !== 'audit') return null;
  return action.relatedEntities?.[0] || null;
}
