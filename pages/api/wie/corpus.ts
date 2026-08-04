// GET/POST/DELETE /api/wie/corpus — GOLD / BAD curated exemplars
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';
import {
  addCorpusEntry,
  listCorpus,
  removeCorpusEntry,
  type CorpusKind,
} from '../../../lib/wie/goldBadCorpus';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

  if (req.method === 'GET') {
    const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
    const entries = await listCorpus(
      kind === 'gold' || kind === 'bad' ? kind : undefined,
    );
    return res.status(200).json({ entries });
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const kind = body.kind;
    if (kind !== 'gold' && kind !== 'bad') {
      return res.status(400).json({ error: 'kind must be gold|bad' });
    }
    const entry = await addCorpusEntry({
      kind: kind as CorpusKind,
      url: typeof body.url === 'string' ? body.url : undefined,
      title: typeof body.title === 'string' ? body.title : undefined,
      note: typeof body.note === 'string' ? body.note : undefined,
      industry: typeof body.industry === 'string' ? body.industry : undefined,
    });
    return res.status(200).json({ entry });
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string'
      ? req.query.id
      : (req.body && typeof req.body === 'object' && typeof (req.body as Record<string, unknown>).id === 'string'
        ? (req.body as Record<string, unknown>).id as string
        : '');
    if (!id) return res.status(400).json({ error: 'id required' });
    const ok = await removeCorpusEntry(id);
    return res.status(ok ? 200 : 404).json({ ok });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withOrgPaymentAccess(handler);
