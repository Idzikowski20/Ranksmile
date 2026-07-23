/**
 * Persist embedding vectors (JSON fallback when pgvector unavailable).
 */
import db from '../../database/database';
import { hashEmbed, pgvectorResearchNotes } from '../semantic/embeddings';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';

export async function ensureEmbeddingTables(): Promise<void> {
  if (checked) return;
  await db
    .query(
      `CREATE TABLE IF NOT EXISTS content_embeddings_json (
      id ${PK},
      workspace_id TEXT,
      doc_id TEXT NOT NULL,
      model TEXT NOT NULL,
      dims INTEGER NOT NULL,
      vector_json ${JSON_T} NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    )
    .catch(() => undefined);
  checked = true;
}

export async function storeHashEmbeddings(opts: {
  workspaceId: string;
  docs: Array<{ id: string; text: string }>;
}): Promise<{ stored: number; pgvectorNotes: ReturnType<typeof pgvectorResearchNotes> }> {
  await ensureEmbeddingTables();
  let stored = 0;
  for (const d of opts.docs.slice(0, 40)) {
    const vector = hashEmbed(d.text);
    await db.query(
      `INSERT INTO content_embeddings_json (workspace_id, doc_id, model, dims, vector_json)
       VALUES (?, ?, ?, ?, ?)`,
      {
        replacements: [
          opts.workspaceId,
          d.id,
          'hash-embed-v1',
          vector.length,
          JSON.stringify(vector),
        ],
      },
    );
    stored += 1;
  }
  return { stored, pgvectorNotes: pgvectorResearchNotes() };
}
