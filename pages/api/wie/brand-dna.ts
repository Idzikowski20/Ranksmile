// GET/POST /api/wie/brand-dna — Brand DNA onboarding + version rollback
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import { getBrandDnaSummary, onboardBrandDna } from '../../../lib/wie/brandDnaOnboarding';
import { listDnaVersions, rollbackDnaVersion } from '../../../lib/wie/patternStore';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  if (req.method === 'GET') {
    const [summary, versions] = await Promise.all([
      getBrandDnaSummary(),
      listDnaVersions(),
    ]);
    return res.status(200).json({ ...summary, versions: versions.versions, currentVersion: versions.current });
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};

    if (body.action === 'rollback') {
      const version = typeof body.version === 'number'
        ? body.version
        : parseInt(String(body.version), 10);
      if (!Number.isFinite(version)) {
        return res.status(400).json({ error: 'version required for rollback' });
      }
      try {
        const store = await rollbackDnaVersion(version);
        const summary = await getBrandDnaSummary();
        const versions = await listDnaVersions();
        return res.status(200).json({
          ok: true,
          restoredVersion: store.dna_version,
          ...summary,
          versions: versions.versions,
          currentVersion: versions.current,
        });
      } catch (e) {
        return res.status(404).json({
          error: e instanceof Error ? e.message : 'rollback_failed',
        });
      }
    }

    const urls = body.urls;
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'urls array required (1–10 https URLs), or action=rollback' });
    }
    const result = await onboardBrandDna({
      urls,
      keyword: typeof body.keyword === 'string' ? body.keyword : undefined,
      industry: typeof body.industry === 'string' ? body.industry : undefined,
    });
    return res.status(200).json(result);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withOrgPaymentAccess(handler);
