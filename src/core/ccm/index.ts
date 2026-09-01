/**
 * Canonical Content Model — types, factory, indexes, hash, serialize.
 * No HTML parsers or coverageSnapshot adapters (ADR / CIA zones).
 */
export * from '@/src/core/ccm/types/index';
export { asSubjectId, asPredicateId, asObjectId } from '@/src/core/ccm/ids';
export { canonicalJsonStringify } from '@/src/core/ccm/canonicalJson';
export {
  computeDeterministicHash,
  computeKnowledgeGraphHash,
  type DeterministicHashInput,
} from '@/src/core/ccm/deterministicHash';
export { buildGraphIndexes } from '@/src/core/ccm/buildIndexes';
export { createEmptyCcm, type EmptyCcmOpts } from '@/src/core/ccm/emptyCcm';
export { serializeCcm, parseCcm, toCcmWire } from '@/src/core/ccm/serialize';
export { ccmWireSchema } from '@/src/core/ccm/ccmSchema';
export {
  buildEntityNodes,
  buildFactNodes,
  buildIntentNodes,
  buildEvidenceForFacts,
  applyWeakFactStatus,
} from '@/src/core/ccm/builders/index';
export {
  graphQuery,
  type GraphQuery,
  type FactFilter,
  type SubgraphPattern,
  type SubgraphMatch,
  type ReasoningPath,
} from '@/src/core/ccm/graphQuery';
export {
  runConstraints,
  applyConstraintStrip,
  DEFAULT_CONSTRAINTS,
  type ConstraintReport,
  type ConstraintViolation,
  type GraphConstraint,
} from '@/src/core/ccm/constraintEngine';

