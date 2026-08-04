import { z } from 'zod';

/** Zod 4: z.record requires key + value schemas. */
const strRecord = <T extends z.ZodType>(value: T) => z.record(z.string(), value);
const unknownRecord = () => z.record(z.string(), z.unknown());

/** Wire: ReadonlyMap → sorted [key, value][] */
const mapEntries = <T extends z.ZodType>(value: T) =>
  z.array(z.tuple([z.string(), value]));

const coverageStatus = z.enum([
  'covered',
  'partial',
  'missing',
  'conflicting',
  'hallucinated',
  'outdated',
  'duplicate',
  'weak',
]);

const importance = z.enum(['critical', 'recommended', 'optional']);

const kgNode = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    kind: z.literal('fact'),
    statement: z.string(),
    subject: z.string(),
    predicate: z.string(),
    object: z.string(),
    entityIds: z.array(z.string()),
    time: z.string().optional(),
    location: z.string().optional(),
    importance,
    confidence: z.number(),
    status: coverageStatus,
    verification: z.enum(['verified', 'asserted', 'inferred', 'rejected']),
    sectionId: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('entity'),
    canonicalName: z.string(),
    aliases: z.array(z.string()),
    wikidataId: z.string().optional(),
    entityType: z.string().optional(),
    mentionCount: z.number(),
    importance,
    confidence: z.number(),
    status: coverageStatus,
  }),
  z.object({
    id: z.string(),
    kind: z.literal('intent'),
    label: z.string(),
    userGoal: z.string(),
    queryVariants: z.array(z.string()),
    priority: z.number(),
    parentId: z.string().optional(),
    childIds: z.array(z.string()),
    importance,
    confidence: z.number(),
    status: coverageStatus,
    primary: z.boolean(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('question'),
    question: z.string(),
    answeredByFactIds: z.array(z.string()),
    answeredBySectionIds: z.array(z.string()),
    importance,
    confidence: z.number(),
    status: coverageStatus,
  }),
  z.object({
    id: z.string(),
    kind: z.literal('topic'),
    label: z.string(),
    cluster: z.string().optional(),
    importance,
    confidence: z.number(),
    status: coverageStatus,
  }),
  z.object({
    id: z.string(),
    kind: z.literal('section'),
    label: z.string(),
    headingLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    order: z.number(),
    importance,
    confidence: z.number(),
    status: coverageStatus,
  }),
  z.object({
    id: z.string(),
    kind: z.literal('citation'),
    label: z.string(),
    url: z.string().optional(),
    authority: z.number().optional(),
    importance,
    confidence: z.number(),
    status: coverageStatus,
  }),
  z.object({
    id: z.string(),
    kind: z.literal('evidence_span'),
    blockId: z.string(),
    startOffset: z.number(),
    endOffset: z.number(),
    snippet: z.string(),
    evidenceKind: z.enum(['example', 'date', 'number', 'quote', 'context']),
    confidence: z.number(),
    status: coverageStatus,
  }),
]);

const kgEdge = z.object({
  id: z.string(),
  type: z.string(),
  from: z.string(),
  to: z.string(),
  predicate: z.string().optional(),
  confidence: z.number(),
});

const wireIndexes = z.object({
  byId: mapEntries(kgNode),
  entityByCanonical: mapEntries(z.string()),
  factsByEntityId: mapEntries(z.array(z.string())),
  factsByIntentId: mapEntries(z.array(z.string())),
  questionsByIntentId: mapEntries(z.array(z.string())),
  intentsByParentId: mapEntries(z.array(z.string())),
  evidenceByFactId: mapEntries(z.array(z.string())),
  edgesByFrom: mapEntries(z.array(z.string())),
  edgesByTo: mapEntries(z.array(z.string())),
  edgesByType: mapEntries(z.array(z.string())),
});

const contentProfile = z.enum([
  'blog',
  'landing',
  'medical',
  'news',
  'legal',
  'product',
  'saas',
  'travel',
  'finance',
  'generic',
]);

/** Wire-format CCM (Maps as sorted entry arrays). */
export const ccmWireSchema = z.object({
  schemaVersion: z.literal(1),
  ccmId: z.string(),
  articleId: z.string(),
  contentHash: z.string(),
  version: z.number(),
  compiledAt: z.string(),
  profile: contentProfile,
  immutable: z.literal(true),
  ast: z.object({
    version: z.literal(1),
    blocks: z.array(unknownRecord()),
  }),
  semanticAst: z.object({
    version: z.literal(1),
    claims: z.array(unknownRecord()),
    discourse: z.array(unknownRecord()),
  }),
  ir: z.object({
    version: z.literal(1),
    contentHash: z.string(),
    paragraphs: z.array(unknownRecord()),
    claims: z.array(unknownRecord()),
    candidates: z.array(unknownRecord()),
  }),
  knowledge: z.object({
    graph: z.object({
      nodes: z.array(kgNode),
      edges: z.array(kgEdge),
    }),
    indexes: wireIndexes,
  }),
  structure: unknownRecord(),
  presentation: unknownRecord(),
  metadata: unknownRecord(),
  reasoning: z.object({
    nodes: z.array(unknownRecord()),
    edges: z.array(unknownRecord()),
  }),
  metrics: unknownRecord(),
  statistics: unknownRecord(),
  references: unknownRecord(),
  embeddings: z.unknown().nullable(),
  compiler: z
    .object({
      compilerId: z.string(),
      compileVersion: z.string(),
      promptVersion: z.string(),
      rulesVersion: z.string(),
      embeddingVersion: z.string().nullable(),
      irVersion: z.string(),
      modelVersions: strRecord(z.string()),
      profileId: contentProfile,
      mode: z.enum(['full', 'incremental', 'adapter']),
      partial: z.boolean(),
      failedStages: z.array(z.string()),
      capabilities: strRecord(z.boolean()),
      deterministicHash: z.string(),
      compileDurationMs: z.number(),
      tokenUsage: strRecord(z.number()),
      cost: z.object({
        currency: z.literal('USD'),
        amount: z.number(),
        breakdown: strRecord(z.number()).optional(),
      }),
      confidence: z.number(),
      notes: z.array(z.string()),
      stagePromptVersions: strRecord(z.string()).optional(),
    })
    .passthrough(),
  legacy: unknownRecord().optional(),
});

export type CcmWire = z.infer<typeof ccmWireSchema>;
