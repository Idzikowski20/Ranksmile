// POST /api/v1/wordpress/disconnect — plugin disconnecting; remove the connection.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { authPluginRequest } from '../../../../lib/wpConnection';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });
   await db.query('DELETE FROM wp_connections WHERE id = ?', { replacements: [conn.id] }).catch(() => {});
   return res.status(200).json({ disconnected: true });
}

export default withOrgPaymentAccess(handler);
