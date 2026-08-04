import type { CanonicalContentModel } from '../ccm/types/ccm';
import type { ActionGraph } from '../ccm/types/actionGraph';
import { parseCcm, serializeCcm } from '../ccm/serialize';
import type { CompileEvent } from './consumerContext';
import type { ConsumerContext, ConsumerResult, ContentConsumer } from './consumerContext';

export type HistoryAppendAck = {
  readonly articleId: string;
  readonly eventCount: number;
  readonly ccmVersion: number;
};

export type StoredArticleCompile = {
  readonly model: CanonicalContentModel;
  readonly actionGraph?: ActionGraph;
  readonly events: CompileEvent[];
};

/** Persistence port — InMemory / SQL implement this. */
export type CompileStore = {
  save(
    articleId: string,
    model: CanonicalContentModel,
    opts?: { readonly actionGraph?: ActionGraph; readonly event?: CompileEvent },
  ): Promise<void>;
  get(articleId: string): Promise<CanonicalContentModel | null>;
  getRecord(articleId: string): Promise<StoredArticleCompile | null>;
  appendEvent(articleId: string, event: CompileEvent): Promise<void>;
  listEvents(articleId: string): Promise<readonly CompileEvent[]>;
};

/**
 * In-memory compile persistence. Implements CompileStore.
 */
export class InMemoryCompileStore implements CompileStore {
  private readonly byArticle = new Map<string, StoredArticleCompile>();

  async save(
    articleId: string,
    model: CanonicalContentModel,
    opts: { readonly actionGraph?: ActionGraph; readonly event?: CompileEvent } = {},
  ): Promise<void> {
    const prev = this.byArticle.get(articleId);
    const events = [...(prev?.events ?? [])];
    if (opts.event) events.push(opts.event);
    this.byArticle.set(articleId, {
      model,
      actionGraph: opts.actionGraph ?? prev?.actionGraph,
      events,
    });
  }

  async get(articleId: string): Promise<CanonicalContentModel | null> {
    return this.byArticle.get(articleId)?.model ?? null;
  }

  async getRecord(articleId: string): Promise<StoredArticleCompile | null> {
    return this.byArticle.get(articleId) ?? null;
  }

  async appendEvent(articleId: string, event: CompileEvent): Promise<void> {
    const prev = this.byArticle.get(articleId);
    if (!prev) {
      throw new Error(`InMemoryCompileStore: unknown article ${articleId}`);
    }
    this.byArticle.set(articleId, {
      ...prev,
      events: [...prev.events, event],
    });
  }

  async listEvents(articleId: string): Promise<readonly CompileEvent[]> {
    return this.byArticle.get(articleId)?.events ?? [];
  }

  clear(): void {
    this.byArticle.clear();
  }
}

export function createHistoryConsumer(store: CompileStore): ContentConsumer<HistoryAppendAck> {
  return {
    id: 'history',
    accept(context: ConsumerContext): Promise<ConsumerResult<HistoryAppendAck>> {
      return acceptHistoryAsync(store, context);
    },
  };
}

/** Async history accept (store may be SQL). */
export async function acceptHistoryAsync(
  store: CompileStore,
  context: ConsumerContext,
): Promise<ConsumerResult<HistoryAppendAck>> {
  const articleId = context.model.articleId;
  const existing = await store.get(articleId);
  if (!existing) {
    await store.save(articleId, context.model, {
      actionGraph: context.actionGraph,
      event: {
        type: 'CompileFinished',
        at: context.model.compiledAt,
        ccmVersion: context.model.version,
        deterministicHash: context.model.compiler.deterministicHash,
        partial: context.model.compiler.partial,
      },
    });
  } else {
    await store.save(articleId, context.model, {
      actionGraph: context.actionGraph,
    });
  }
  await store.appendEvent(articleId, {
    type: 'ConsumerRun',
    at: context.model.compiledAt,
    consumerId: 'history',
    ccmVersion: context.model.version,
  });
  const events = await store.listEvents(articleId);
  return {
    consumerId: 'history',
    fromCcmVersion: context.model.version,
    confidence: 1,
    result: {
      articleId,
      eventCount: events.length,
      ccmVersion: context.model.version,
    },
  };
}

/** Wire helpers for snapshot blob columns. */
export function ccmToBlob(model: CanonicalContentModel): string {
  return serializeCcm(model);
}

export function ccmFromBlob(blob: string): CanonicalContentModel | null {
  return parseCcm(blob);
}
