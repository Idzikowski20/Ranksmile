import { ensureAiVisibilityTables } from './ensureAiVisibilityTables';
import { ensureKeywordResearchTables } from './ensureKeywordResearchTables';
import { queryOne } from './db/query';

export interface OrgPlanUsage {
  documents: number;
  aiPrompts: number;
  brandSpaces: number;
  keywordResearch: number;
}

const isPostgres = !!process.env.DATABASE_URL;

export async function getOrgPlanUsage(orgId: number): Promise<OrgPlanUsage> {
  await Promise.all([ensureAiVisibilityTables(), ensureKeywordResearchTables()]);

  const monthFilter = isPostgres
    ? "r.created_at >= date_trunc('month', CURRENT_TIMESTAMP)"
    : "r.created_at >= datetime('now', 'start of month')";

  const [documentsRow, brandSpacesRow, aiPromptsRow, keywordRow] = await Promise.all([
    queryOne<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM articles a
        JOIN domain d ON d."ID" = a.domain_id
        JOIN workspaces w ON w.id = d.workspace_id
       WHERE w.org_id = ?`,
      [orgId],
    ),
    queryOne<{ n: number | string }>(
      "SELECT COUNT(*) AS n FROM workspaces WHERE org_id = ? AND status = 'ready'",
      [orgId],
    ),
    queryOne<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM ai_vis_prompts p
        JOIN ai_vis_configs c ON c.id = p.config_id
        JOIN domain d ON d."ID" = c.domain_id
        JOIN workspaces w ON w.id = d.workspace_id
       WHERE w.org_id = ? AND p.selected = 1`,
      [orgId],
    ),
    queryOne<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM keyword_research_runs r
        JOIN domain d ON d."ID" = r.domain_id
        JOIN workspaces w ON w.id = d.workspace_id
       WHERE w.org_id = ? AND ${monthFilter}`,
      [orgId],
    ),
  ]);

  return {
    documents: Number(documentsRow?.n ?? 0),
    brandSpaces: Number(brandSpacesRow?.n ?? 0),
    aiPrompts: Number(aiPromptsRow?.n ?? 0),
    keywordResearch: Number(keywordRow?.n ?? 0),
  };
}
