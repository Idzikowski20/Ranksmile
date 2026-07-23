/**
 * Domain Knowledge Store — brand + knowledge_edges API.
 */
import db from '../../database/database';
import { ensureCorpusTables } from '../ensureCorpusTables';

export type BrandKnowledge = {
  workspaceId: string;
  brand?: string;
  products: string[];
  usp?: string;
  style?: string;
  entities: string[];
  forbiddenClaims: string[];
  preferredSources: string[];
};

export type KnowledgeEdge = {
  workspaceId: string;
  sourceType: string;
  sourceId: string;
  relation: string;
  targetType: string;
  targetId: string;
  weight?: number;
  version?: number;
};

function parseJsonArr(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  if (typeof raw === 'string') {
    try {
      return parseJsonArr(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

export async function getBrandKnowledge(workspaceId: string): Promise<BrandKnowledge | null> {
  await ensureCorpusTables();
  const [rows] = await db.query(
    `SELECT * FROM workspace_brand_knowledge WHERE workspace_id = ? LIMIT 1`,
    { replacements: [workspaceId] },
  );
  const r = (rows as Array<Record<string, unknown>>)[0];
  if (!r) return null;
  return {
    workspaceId,
    brand: r.brand != null ? String(r.brand) : undefined,
    products: parseJsonArr(r.products_json),
    usp: r.usp != null ? String(r.usp) : undefined,
    style: r.style != null ? String(r.style) : undefined,
    entities: parseJsonArr(r.entities_json),
    forbiddenClaims: parseJsonArr(r.forbidden_claims_json),
    preferredSources: parseJsonArr(r.preferred_sources_json),
  };
}

export async function upsertBrandKnowledge(k: BrandKnowledge): Promise<void> {
  await ensureCorpusTables();
  const existing = await getBrandKnowledge(k.workspaceId);
  if (existing) {
    await db.query(
      `UPDATE workspace_brand_knowledge SET
        brand = ?, products_json = ?, usp = ?, style = ?,
        entities_json = ?, forbidden_claims_json = ?, preferred_sources_json = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE workspace_id = ?`,
      {
        replacements: [
          k.brand ?? null,
          JSON.stringify(k.products),
          k.usp ?? null,
          k.style ?? null,
          JSON.stringify(k.entities),
          JSON.stringify(k.forbiddenClaims),
          JSON.stringify(k.preferredSources),
          k.workspaceId,
        ],
      },
    );
    return;
  }
  await db.query(
    `INSERT INTO workspace_brand_knowledge
      (workspace_id, brand, products_json, usp, style, entities_json,
       forbidden_claims_json, preferred_sources_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      replacements: [
        k.workspaceId,
        k.brand ?? null,
        JSON.stringify(k.products),
        k.usp ?? null,
        k.style ?? null,
        JSON.stringify(k.entities),
        JSON.stringify(k.forbiddenClaims),
        JSON.stringify(k.preferredSources),
      ],
    },
  );
}

export async function addKnowledgeEdge(edge: KnowledgeEdge): Promise<void> {
  await ensureCorpusTables();
  await db.query(
    `INSERT INTO knowledge_edges
      (workspace_id, source_type, source_id, relation, target_type, target_id, weight, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      replacements: [
        edge.workspaceId,
        edge.sourceType,
        edge.sourceId,
        edge.relation,
        edge.targetType,
        edge.targetId,
        edge.weight ?? 1,
        edge.version ?? 1,
      ],
    },
  );
}

export async function listKnowledgeEdges(
  workspaceId: string,
  limit = 100,
): Promise<KnowledgeEdge[]> {
  await ensureCorpusTables();
  const [rows] = await db.query(
    `SELECT * FROM knowledge_edges WHERE workspace_id = ? ORDER BY id DESC LIMIT ?`,
    { replacements: [workspaceId, limit] },
  );
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    workspaceId: String(r.workspace_id),
    sourceType: String(r.source_type),
    sourceId: String(r.source_id),
    relation: String(r.relation),
    targetType: String(r.target_type),
    targetId: String(r.target_id),
    weight: Number(r.weight ?? 1),
    version: Number(r.version ?? 1),
  }));
}

/** Seed DKS snippets for AO prompts. */
export function brandKnowledgePromptSeed(k: BrandKnowledge | null): string {
  if (!k) return '';
  const lines = [
    k.brand ? `Brand: ${k.brand}` : '',
    k.usp ? `USP: ${k.usp}` : '',
    k.style ? `Style: ${k.style}` : '',
    k.products.length ? `Products: ${k.products.slice(0, 8).join(', ')}` : '',
    k.forbiddenClaims.length
      ? `Forbidden claims: ${k.forbiddenClaims.slice(0, 5).join('; ')}`
      : '',
  ].filter(Boolean);
  return lines.length ? `Domain knowledge:\n${lines.join('\n')}` : '';
}
