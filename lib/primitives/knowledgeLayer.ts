import type {
  Action,
  KnowledgeEdge,
  KnowledgeLayerStub,
  KnowledgeNode,
  Observation,
} from './types';

/** Empty Knowledge Layer — Topic→Intent→Entity→Page→Action→Outcome foundation. */
export function emptyKnowledgeLayer(): KnowledgeLayerStub {
  return {
    topics: [],
    intents: [],
    questions: [],
    entities: [],
    pages: [],
    actions: [],
    outcomes: [],
    edges: [],
  };
}

function node(id: string, type: KnowledgeNode['type'], label: string, meta?: Record<string, unknown>): KnowledgeNode {
  return { id, type, label, meta };
}

function edge(from: string, to: string, rel: string, weight?: number): KnowledgeEdge {
  return { from, to, rel, weight };
}

export type BuildKnowledgeInput = {
  keyword?: string;
  articleId?: string | number;
  articleTitle?: string;
  observations?: Observation[];
  actions?: Action[];
};

/**
 * Build a Knowledge Layer graph from Observations + Actions.
 * Chain: Topic → Intent → Question → (Entity) → Page → Action → Outcome(stub).
 */
export function buildKnowledgeLayer(input: BuildKnowledgeInput): KnowledgeLayerStub {
  const kg = emptyKnowledgeLayer();
  const keyword = (input.keyword || '').trim() || 'topic';
  const topicId = `topic:${keyword.toLowerCase()}`;
  kg.topics.push(node(topicId, 'topic', keyword));

  const intentId = `intent:${keyword.toLowerCase()}:informational`;
  kg.intents.push(node(intentId, 'intent', 'informational', { keyword }));
  kg.edges.push(edge(topicId, intentId, 'has_intent'));

  const pageId =
    input.articleId != null
      ? `page:${input.articleId}`
      : `page:draft:${keyword.toLowerCase().replace(/\s+/g, '-')}`;
  kg.pages.push(
    node(pageId, 'page', input.articleTitle || keyword, {
      articleId: input.articleId,
    }),
  );
  kg.edges.push(edge(topicId, pageId, 'has_page'));

  for (const obs of input.observations || []) {
    if (obs.relatedQuestionIds?.length || obs.kind.includes('faq') || obs.kind.includes('topic') || obs.kind.includes('gap')) {
      const qId = obs.relatedQuestionIds?.[0] || `question:${obs.id}`;
      if (!kg.questions.some((q) => q.id === qId)) {
        kg.questions.push(node(qId, 'question', obs.title, { observationId: obs.id, kind: obs.kind }));
      }
      kg.edges.push(edge(intentId, qId, 'asks'));
      kg.edges.push(edge(qId, pageId, 'should_cover', obs.confidence));
    }
    if (obs.kind.includes('entity') || obs.relatedEntityIds?.length) {
      for (const eid of obs.relatedEntityIds?.length ? obs.relatedEntityIds : [`entity:${obs.id}`]) {
        if (!kg.entities.some((e) => e.id === eid)) {
          kg.entities.push(node(eid, 'entity', obs.title, { observationId: obs.id }));
        }
        kg.edges.push(edge(topicId, eid, 'mentions_entity'));
        kg.edges.push(edge(pageId, eid, 'needs_entity'));
      }
    }
  }

  for (const a of input.actions || []) {
    const aId = `action:${a.id}`;
    if (!kg.actions.some((x) => x.id === aId)) {
      kg.actions.push(
        node(aId, 'action', a.title, {
          type: a.type,
          expectedLift: a.expectedLift,
          origin: a.origin,
        }),
      );
    }
    kg.edges.push(edge(pageId, aId, 'recommends'));
    for (const q of a.relatedQuestions || []) {
      const qId = q.startsWith('question:') ? q : `question:${q}`;
      if (!kg.questions.some((x) => x.id === qId)) {
        kg.questions.push(node(qId, 'question', q));
      }
      kg.edges.push(edge(aId, qId, 'targets_question'));
    }
    for (const e of a.relatedEntities || []) {
      const eId = e.startsWith('entity:') ? e : `entity:${e}`;
      if (!kg.entities.some((x) => x.id === eId)) {
        kg.entities.push(node(eId, 'entity', e));
      }
      kg.edges.push(edge(aId, eId, 'targets_entity'));
    }
    const outcomeId = `outcome:${a.id}:pending`;
    kg.outcomes.push(node(outcomeId, 'outcome', `Pending: ${a.title}`, { status: 'pending' }));
    kg.edges.push(edge(aId, outcomeId, 'expects_outcome'));
  }

  return kg;
}
