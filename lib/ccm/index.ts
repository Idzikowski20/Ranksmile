/**
 * Canonical Content Model — types, factory, indexes, hash, serialize.
 * No HTML parsers or coverageSnapshot adapters (ADR / CIA zones).
 */
export * from './types';
export { asSubjectId, asPredicateId, asObjectId } from './ids';
export { canonicalJsonStringify } from './canonicalJson';
export {
  computeDeterministicHash,
  computeKnowledgeGraphHash,
  type DeterministicHashInput,
} from './deterministicHash';
export { buildGraphIndexes } from './buildIndexes';
export { createEmptyCcm, type EmptyCcmOpts } from './emptyCcm';
export { serializeCcm, parseCcm, toCcmWire } from './serialize';
export { ccmWireSchema } from './ccmSchema';
export {
  buildEntityNodes,
  buildFactNodes,
  buildIntentNodes,
  buildEvidenceForFacts,
  applyWeakFactStatus,
} from './builders';
export {
  graphQuery,
  type GraphQuery,
  type FactFilter,
  type SubgraphPattern,
  type SubgraphMatch,
  type ReasoningPath,
} from './graphQuery';
export {
  runConstraints,
  applyConstraintStrip,
  DEFAULT_CONSTRAINTS,
  type ConstraintReport,
  type ConstraintViolation,
  type GraphConstraint,
} from './constraintEngine';

