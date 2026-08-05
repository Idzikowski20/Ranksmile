import { queryOne, queryRows } from '../db/query';
import type { CanonicalContentModel } from '../ccm/types/ccm';
import type { ActionGraph } from '../ccm/types/actionGraph';
import { ensureCcmTables } from '../ensureCcmTables';
import type { CompileEvent } from './consumerContext';
import {
  ccmFromBlob,
  ccmToBlob,
  type CompileStore,
  type StoredArticleCompile,
} from './compileStore';

type SnapshotRow = {
  article_id: string;
  version: number;
  snapshot_json: string;
  action_graph_json: string | null;
};

type EventRow = {
  event_json: string;
};

/**
 * SQL-backed CompileStore (cia_ccm_snapshots + cia_compile_events).
 * Call ensureCcmTables() once at process start / first use.
 */
export class SqlCompileStore implements CompileStore {
  async save(
    articleId: string,
    model: CanonicalContentModel,
    opts: { readonly actionGraph?: ActionGraph; readonly event?: CompileEvent } = {},
  ): Promise<void> {
    await ensureCcmTables();
    const blob = ccmToBlob(model);
    const agJson = opts.actionGraph ? JSON.stringify(opts.actionGraph) : null;

    const existing = await queryOne<SnapshotRow>(
      `SELECT article_id, version, snapshot_json, action_graph_json
       FROM cia_ccm_snapshots WHERE article_id = ? AND version = ?`,
      [articleId, model.version],
    );

    if (existing) {
      await queryRows(
        `UPDATE cia_ccm_snapshots
         SET ccm_id = ?, content_hash = ?, deterministic_hash = ?, compiled_at = ?,
             snapshot_json = ?, action_graph_json = COALESCE(?, action_graph_json)
         WHERE article_id = ? AND version = ?`,
        [
          model.ccmId,
          model.contentHash,
          model.compiler.deterministicHash,
          model.compiledAt,
          blob,
          agJson,
          articleId,
          model.version,
        ],
      );
    } else {
      await queryRows(
        `INSERT INTO cia_ccm_snapshots
          (article_id, ccm_id, version, content_hash, deterministic_hash, compiled_at, snapshot_json, action_graph_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          articleId,
          model.ccmId,
          model.version,
          model.contentHash,
          model.compiler.deterministicHash,
          model.compiledAt,
          blob,
          agJson,
        ],
      );
    }

    if (opts.event) {
      await this.appendEvent(articleId, opts.event);
    }
  }

  async get(articleId: string): Promise<CanonicalContentModel | null> {
    const rec = await this.getRecord(articleId);
    return rec?.model ?? null;
  }

  async getRecord(articleId: string): Promise<StoredArticleCompile | null> {
    await ensureCcmTables();
    const row = await queryOne<SnapshotRow>(
      `SELECT article_id, version, snapshot_json, action_graph_json
       FROM cia_ccm_snapshots
       WHERE article_id = ?
       ORDER BY version DESC
       LIMIT 1`,
      [articleId],
    );
    if (!row) return null;
    const model = ccmFromBlob(row.snapshot_json);
    if (!model) return null;
    let actionGraph: ActionGraph | undefined;
    if (row.action_graph_json) {
      try {
        actionGraph = JSON.parse(row.action_graph_json) as ActionGraph;
      } catch {
        actionGraph = undefined;
      }
    }
    const events = await this.listEvents(articleId);
    return { model, actionGraph, events: [...events] };
  }

  async appendEvent(articleId: string, event: CompileEvent): Promise<void> {
    await ensureCcmTables();
    const ccmVersion =
      'ccmVersion' in event
        ? event.ccmVersion
        : 'toVersion' in event
          ? event.toVersion
          : 0;
    const recordedAt =
      'at' in event && typeof event.at === 'string' ? event.at : new Date().toISOString();
    await queryRows(
      `INSERT INTO cia_compile_events (article_id, ccm_version, event_type, event_json, recorded_at)
       VALUES (?, ?, ?, ?, ?)`,
      [articleId, ccmVersion, event.type, JSON.stringify(event), recordedAt],
    );
  }

  async listEvents(articleId: string): Promise<readonly CompileEvent[]> {
    await ensureCcmTables();
    const rows = await queryRows<EventRow>(
      `SELECT event_json FROM cia_compile_events
       WHERE article_id = ?
       ORDER BY id ASC`,
      [articleId],
    );
    return rows.map((r) => JSON.parse(r.event_json) as CompileEvent);
  }
}
