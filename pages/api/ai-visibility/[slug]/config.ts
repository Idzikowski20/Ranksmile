import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { getErrorMessage } from '../../../../lib/errors';
import { queryOne, queryRows } from '../../../../lib/db/query';
import { AiVisConfig, AiVisTopic, AI_VIS_DEFAULT_MODELS, AI_VIS_PROMPT_LIMIT, sanitizeModels, normalizeAiVisPriority, type AiVisPriority } from '../../../../lib/aiVisibility';

type ConfigRow = { id: number, brand_name: string, prompt_limit: number, models: string | null, completed_at: string | null, priority: string | null };
type PromptRow = { id: number, topic: string, text: string, provenance: string | null, selected: number };

const parseJsonArray = (raw: string | null): string[] => {
   if (!raw) return [];
   try { const v = JSON.parse(raw); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
};

async function loadConfig(domainId: number): Promise<AiVisConfig | null> {
   const row = await queryOne<ConfigRow>('SELECT * FROM ai_vis_configs WHERE domain_id = ? LIMIT 1', [domainId]);
   if (!row) return null;
   const prompts = await queryRows<PromptRow>(
      'SELECT id, topic, text, provenance, selected FROM ai_vis_prompts WHERE config_id = ? ORDER BY sort_order, id', [row.id],
   );
   const topics: AiVisTopic[] = [];
   for (const p of prompts) {
      let t = topics.find((x) => x.title === p.topic);
      if (!t) { t = { title: p.topic, prompts: [] }; topics.push(t); }
      t.prompts.push({ id: p.id, text: p.text, provenance: parseJsonArray(p.provenance), selected: !!p.selected });
   }
   return {
      id: row.id,
      brandName: row.brand_name,
      promptLimit: row.prompt_limit || AI_VIS_PROMPT_LIMIT,
      models: sanitizeModels(parseJsonArray(row.models)),
      priority: normalizeAiVisPriority(row.priority),
      completedAt: row.completed_at,
      topics,
   };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAiVisibilityTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domain = ownership as unknown as { ID: number, domain: string };

   try {
      if (req.method === 'GET') {
         return res.status(200).json({ config: await loadConfig(domain.ID) });
      }
      if (req.method === 'POST') {
         const { brandName, topics, priority } = req.body as { brandName?: string, topics?: AiVisTopic[], priority?: AiVisPriority };
         if (!brandName || !Array.isArray(topics)) return res.status(400).json({ error: 'brandName and topics are required' });
         const tier = normalizeAiVisPriority(priority);
         const selectedCount = topics.reduce((n, t) => n + t.prompts.filter((p) => p.selected).length, 0);
         if (selectedCount === 0) return res.status(400).json({ error: 'Select at least one prompt' });
         if (selectedCount > AI_VIS_PROMPT_LIMIT) return res.status(400).json({ error: `Prompt limit is ${AI_VIS_PROMPT_LIMIT}` });

         const {
            getOrgIdForDomain,
            ensureOrgQuotaBalances,
            adjustActiveUsage,
            isPlanLimitError,
            planLimitBody,
         } = await import('../../../../lib/quota');
         const orgId = await getOrgIdForDomain(domain.ID);
         if (!orgId) return res.status(400).json({ error: 'Domain has no organization' });
         await ensureOrgQuotaBalances(orgId);

         const priorConfig = await loadConfig(domain.ID);
         const oldDomainSelected = priorConfig
            ? priorConfig.topics.reduce((n, t) => n + t.prompts.filter((p) => p.selected).length, 0)
            : 0;
         const domainDelta = selectedCount - oldDomainSelected;

         try {
            await db.transaction(async (tx) => {
               if (domainDelta !== 0) {
                  await adjustActiveUsage(
                     {
                        orgId,
                        meter: 'aiPrompts',
                        delta: domainDelta,
                        idempotencyKey: `ai-prompts:${domain.ID}:${oldDomainSelected}->${selectedCount}`,
                        ref: { type: 'ai_vis_config', id: String(domain.ID) },
                        userId,
                     },
                     { transaction: tx },
                  );
               }

               const existing = await queryOne<{ id: number }>('SELECT id FROM ai_vis_configs WHERE domain_id = ? LIMIT 1', [domain.ID]);
               let configId: number;
               if (existing) {
                  configId = existing.id;
                  await db.query(
                     'UPDATE ai_vis_configs SET brand_name = ?, priority = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                     { replacements: [brandName, tier, configId], transaction: tx },
                  );
               } else {
                  await db.query(
                     'INSERT INTO ai_vis_configs (domain_id, brand_name, prompt_limit, models, priority, completed_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                     { replacements: [domain.ID, brandName, AI_VIS_PROMPT_LIMIT, JSON.stringify(AI_VIS_DEFAULT_MODELS), tier], transaction: tx },
                  );
                  const createdRows = await db.query(
                     'SELECT id FROM ai_vis_configs WHERE domain_id = ? LIMIT 1',
                     { replacements: [domain.ID], transaction: tx },
                  ) as [Array<{ id: number }>, unknown];
                  const created = createdRows[0][0];
                  if (!created) throw new Error('Failed to create config');
                  configId = created.id;
               }

               const priorRows = await queryRows<{ id: number, text: string }>('SELECT id, text FROM ai_vis_prompts WHERE config_id = ?', [configId]);
               // note: priorRows outside tx is fine for id set; mutations use tx
               const priorById = new Map(priorRows.map((r) => [r.id, r.text]));
               const keptIds = new Set<number>();
               let order = 0;
               for (const t of topics) {
                  for (const p of t.prompts) {
                     const pid = Number((p as { id?: number }).id) || 0;
                     const isCustom = (p as { isCustom?: boolean }).isCustom ? 1 : 0;
                     if (pid > 0 && priorById.has(pid)) {
                        keptIds.add(pid);
                        await db.query(
                           'UPDATE ai_vis_prompts SET topic = ?, text = ?, provenance = ?, selected = ?, is_custom = ?, sort_order = ? WHERE id = ?',
                           { replacements: [t.title, p.text, JSON.stringify(p.provenance || []), p.selected ? 1 : 0, isCustom, order, pid], transaction: tx },
                        );
                        if (priorById.get(pid) !== p.text) {
                           await db.query('DELETE FROM ai_vis_results WHERE prompt_id = ?', { replacements: [pid], transaction: tx });
                        }
                     } else {
                        await db.query(
                           'INSERT INTO ai_vis_prompts (config_id, topic, text, provenance, selected, is_custom, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
                           { replacements: [configId, t.title, p.text, JSON.stringify(p.provenance || []), p.selected ? 1 : 0, isCustom, order], transaction: tx },
                        );
                     }
                     order += 1;
                  }
               }
               const removed = priorRows.filter((r) => !keptIds.has(r.id));
               for (const r of removed) {
                  await db.query('DELETE FROM ai_vis_results WHERE prompt_id = ?', { replacements: [r.id], transaction: tx });
                  await db.query('DELETE FROM ai_vis_prompts WHERE id = ?', { replacements: [r.id], transaction: tx });
               }
            });
         } catch (e) {
            if (isPlanLimitError(e)) return res.status(402).json(planLimitBody(e));
            throw e;
         }
         return res.status(200).json({ config: await loadConfig(domain.ID) });
      }
      if (req.method === 'PATCH') {
         const { priority } = req.body as { priority?: AiVisPriority };
         if (!priority) return res.status(400).json({ error: 'priority is required' });
         const tier = normalizeAiVisPriority(priority);
         const existing = await queryOne<{ id: number }>('SELECT id FROM ai_vis_configs WHERE domain_id = ? LIMIT 1', [domain.ID]);
         if (!existing) return res.status(400).json({ error: 'Complete the AI Visibility setup first' });
         await db.query('UPDATE ai_vis_configs SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', { replacements: [tier, existing.id] });
         return res.status(200).json({ config: await loadConfig(domain.ID) });
      }
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ error: 'Method not allowed' });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'Config failed' });
   }
}
