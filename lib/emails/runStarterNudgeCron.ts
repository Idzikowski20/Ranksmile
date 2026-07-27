import db from '../../database/database';
import { ensureBillingTables } from '../ensureBillingTables';
import {
  getOrgBillingState,
  hasNonTerminalStripeSubscription,
  updateOrgBillingState,
} from '../orgBilling';
import { queryRows } from '../db/query';
import { sendStarterNudgeEmail } from './sendStarterNudgeEmail';

const DAY_MS = 24 * 60 * 60 * 1000;

export type StarterNudgeCronResult = {
  scanned: number;
  sent: number;
  skipped: number;
};

/**
 * Free orgs aged 3–10 days without starter_nudge_sent_at.
 * Skips orgs with a non-terminal Stripe subscription. Marks sent only after SMTP accept.
 */
export async function runStarterNudgeCron(now = new Date()): Promise<StarterNudgeCronResult> {
  await ensureBillingTables();

  const result: StarterNudgeCronResult = { scanned: 0, sent: 0, skipped: 0 };
  const minCreated = new Date(now.getTime() - 10 * DAY_MS).toISOString();
  const maxCreated = new Date(now.getTime() - 3 * DAY_MS).toISOString();

  const orgs = await queryRows<{ id: number }>(
    `SELECT id FROM organizations
      WHERE starter_nudge_sent_at IS NULL
        AND created_at <= ?
        AND created_at >= ?
      ORDER BY id ASC
      LIMIT 200`,
    [maxCreated, minCreated],
  );

  for (const { id: orgId } of orgs) {
    result.scanned += 1;
    try {
      const billing = await getOrgBillingState(orgId);
      if (hasNonTerminalStripeSubscription(billing)) {
        result.skipped += 1;
        continue;
      }

      const [memRows] = await db.query(
        `SELECT email FROM organization_members
          WHERE org_id = ? AND status = 'active' AND role = 'owner'
            AND email IS NOT NULL AND email <> ''
          LIMIT 1`,
        { replacements: [orgId] },
      );
      const to = (memRows as Array<{ email: string }>)[0]?.email;
      if (!to) {
        result.skipped += 1;
        continue;
      }

      const { sent } = await sendStarterNudgeEmail(to);
      if (!sent) {
        result.skipped += 1;
        continue;
      }
      await updateOrgBillingState(orgId, { starterNudgeSentAt: now });
      result.sent += 1;
    } catch (err) {
      result.skipped += 1;
      console.warn('[starter-nudge] org', orgId, err);
    }
  }

  return result;
}

/** Exposed for tests — same age window as the cron query. */
export function isOrgInStarterNudgeAgeWindow(
  createdAt: Date | string,
  now = new Date(),
): boolean {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const ageMs = now.getTime() - created.getTime();
  return ageMs >= 3 * DAY_MS && ageMs <= 10 * DAY_MS;
}
