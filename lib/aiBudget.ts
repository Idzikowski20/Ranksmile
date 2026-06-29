import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../utils/getUser';
import { ensureUserTenancy } from './tenancy';
import { getOrgUsage5h, recordAiTokens } from './aiTokenUsage';

export { recordAiTokens };

/** The caller's organization id, or null when it can't be resolved (best-effort — never blocks). */
export async function resolveOrgId(req: NextApiRequest, res: NextApiResponse): Promise<number | null> {
  try { const uid = await getCurrentUserId(req, res); return (await ensureUserTenancy(String(uid))).orgId; } catch { return null; }
}

export type OverBudget = { error: 'org_limit'; resetsAt: number; used: number; limit: number };

/**
 * Returns a 429 payload when the org has spent its shared 5h AI-token pool, else null.
 * Use on every AI/LLM-spend endpoint so none can bypass the budget:
 *   const orgId = await resolveOrgId(req, res);
 *   const over = await orgBudgetBlocked(orgId);
 *   if (over) return res.status(429).json(over);
 *   ...do work...; await recordAiTokens(orgId, tokens);
 */
export async function orgBudgetBlocked(orgId: number | null): Promise<OverBudget | null> {
  if (orgId == null) return null;
  const u = await getOrgUsage5h(orgId);
  return u.over ? { error: 'org_limit', resetsAt: u.resetsAt, used: u.used, limit: u.limit } : null;
}
