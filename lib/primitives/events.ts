import type { DomainEvent, DomainEventType } from './types';

/** Q1: event type union only. Emit/persist in Q2. */
export const DOMAIN_EVENT_TYPES: DomainEventType[] = [
  'SnapshotCreated',
  'CoverageUpdated',
  'VisibilityUpdated',
  'ScoreChanged',
  'RecommendationAccepted',
  'RecommendationRejected',
  'ArticlePublished',
  'ObservationRecorded',
  'FeatureComputed',
  'ActionExecuted',
];

export function makeDomainEvent(
  type: DomainEventType,
  payload?: DomainEvent['payload'],
  ids?: { domainId?: number; articleId?: number },
): DomainEvent {
  return {
    type,
    at: new Date().toISOString(),
    domainId: ids?.domainId,
    articleId: ids?.articleId,
    payload,
  };
}
