// GET/PUT /api/content-settings — shared Brand Knowledge (global file) + per-domain Custom Voices.
import type { NextApiRequest, NextApiResponse } from 'next';
import { readContentSettings, writeContentSettings } from '@/src/infrastructure/stores/contentSettings';
import { getDomainVoices, setDomainVoices } from '@/src/infrastructure/seo/domainVoices';
import { getDomainTemplates, setDomainTemplates } from '@/src/infrastructure/seo/domainTemplates';
import { getActiveWorkspaceId } from '@/src/infrastructure/identity/tenancy';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { getCurrentUserId } from '../../utils/getUser';
import db from '../../database/database';
import verifyUser from '../../utils/verifyUser';

type Row = Record<string, any>;

/** The active workspace's domain id (workspace=domain 1:1), or 0 when the user has none. */
async function getActiveDomainId(req: NextApiRequest, userId: string | null): Promise<number> {
  if (!userId) return 0;
  const workspaceId = await getActiveWorkspaceId(req, userId);
  if (!workspaceId) return 0;
  const [rows] = await db.query('SELECT "ID" FROM domain WHERE workspace_id = ? LIMIT 1', {
    replacements: [workspaceId],
  }) as [Row[], unknown];
  return rows.length ? Number(rows[0].ID) : 0;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  const userId = await getCurrentUserId(req, res);

  if (req.method === 'GET') {
    const domainId = await getActiveDomainId(req, userId);
    const { brandKnowledge, brandName } = await readContentSettings();
    const voices = domainId ? await getDomainVoices(domainId) : [];
    const templates = domainId ? await getDomainTemplates(domainId) : [];
    return res.status(200).json({ voices, templates, brandKnowledge, brandName });
  }

  if (req.method === 'PUT') {
    const { brandName, brandKnowledge, voices, templates } = req.body || {};

    const domainId = await getActiveDomainId(req, userId);
    if (Array.isArray(voices) && domainId) await setDomainVoices(domainId, voices);
    if (Array.isArray(templates) && domainId) await setDomainTemplates(domainId, templates);

    const partial: Partial<{ brandName: string; brandKnowledge: string }> = {};
    if (brandName !== undefined) partial.brandName = String(brandName);
    if (brandKnowledge !== undefined) partial.brandKnowledge = String(brandKnowledge);
    const settings = Object.keys(partial).length ? await writeContentSettings(partial) : await readContentSettings();

    const savedVoices = domainId ? await getDomainVoices(domainId) : (Array.isArray(voices) ? voices : []);
    const savedTemplates = domainId ? await getDomainTemplates(domainId) : (Array.isArray(templates) ? templates : []);
    return res.status(200).json({ voices: savedVoices, templates: savedTemplates, brandKnowledge: settings.brandKnowledge, brandName: settings.brandName });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withOrgPaymentAccess(handler);
