import type { ObjectId, PredicateId, SubjectId } from './types/ids';

export function asSubjectId(value: string): SubjectId {
  return value as SubjectId;
}

export function asPredicateId(value: string): PredicateId {
  return value as PredicateId;
}

export function asObjectId(value: string): ObjectId {
  return value as ObjectId;
}
