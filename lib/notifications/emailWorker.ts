import Keyword from '../../database/models/keyword';
import generateEmail from '../../utils/generateEmail';
import parseKeywords from '../../utils/parseKeywords';
import { getAppSettings } from '../../pages/api/settings';
import { sendMail } from '../sendMail';
import {
  claimEmailJob,
  getEmailJobById,
  markEmailDlq,
  markEmailFailed,
  markEmailSent,
  markEmailSkipped,
} from './emailJobState';
import {
  backoffMs,
  EMAIL_JOB_TYPE_ABANDONED_CHECKOUT,
  EMAIL_JOB_TYPE_PAYMENT_FAILED,
  EMAIL_JOB_TYPE_STARTER_NUDGE,
  type EmailJobRow,
} from './emailTypes';
import { paymentFailedEmailHtml } from '../emails/paymentFailedEmail';
import { abandonedCheckoutEmailHtml } from '../emails/abandonedCheckoutEmail';
import { starterNudgeEmailHtml } from '../emails/starterNudgeEmail';

function parsePayload(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

async function failOrDlq(claimed: EmailJobRow, errMsg: string): Promise<void> {
  const refreshed = await getEmailJobById(claimed.id);
  const attempts = refreshed?.attempts ?? claimed.attempts;
  const maxAttempts = refreshed?.max_attempts ?? claimed.max_attempts;
  if (attempts >= maxAttempts) {
    await markEmailDlq(claimed.id, errMsg);
    return;
  }
  await markEmailFailed(claimed.id, errMsg, new Date(Date.now() + backoffMs(attempts)));
}

/**
 * Process one email outbox job. Retry is DB-owned (poller re-picks failed due rows).
 * Crash after SMTP accept before markSent may duplicate on stale recovery (at-least-once).
 */
export async function processEmailJob(dbJobId: number): Promise<void> {
  const claimed = await claimEmailJob(dbJobId);
  if (!claimed) return;

  try {
    const payload = parsePayload(claimed.payload_json);
    let subject = str(payload.subject, 'Ranksmile');
    let html = '';

    if (claimed.type === EMAIL_JOB_TYPE_PAYMENT_FAILED) {
      html = paymentFailedEmailHtml({
        planName: str(payload.planName, 'subscription'),
        updateUrl: str(payload.updateUrl, '#'),
      });
      subject = str(payload.subject, subject);
    } else if (claimed.type === EMAIL_JOB_TYPE_ABANDONED_CHECKOUT) {
      html = abandonedCheckoutEmailHtml({
        checkoutUrl: str(payload.checkoutUrl, '#'),
      });
      subject = str(payload.subject, subject);
    } else if (claimed.type === EMAIL_JOB_TYPE_STARTER_NUDGE) {
      html = starterNudgeEmailHtml({
        checkoutUrl: str(payload.checkoutUrl, '#'),
      });
      subject = str(payload.subject, subject);
    } else {
      // keyword_positions_update (default)
      const settings = await getAppSettings();
      const domainKeywords = await Keyword.findAll({ where: { domain: claimed.domain } });
      const keywordsArray = domainKeywords.map((el) => el.get({ plain: true }));
      const keywords = parseKeywords(keywordsArray);
      html = await generateEmail(claimed.domain, keywords, settings);
      subject = `[${claimed.domain}] Keyword Positions Update`;
    }

    const result = await sendMail({
      to: claimed.to_email,
      subject,
      html,
    });

    if (result.smtpNotConfigured) {
      await markEmailSkipped(claimed.id, 'smtp_not_configured');
      return;
    }

    if (result.sent) {
      await markEmailSent(claimed.id, result.providerMsgId);
      return;
    }

    const errMsg = result.error || 'sendMail failed';
    if (result.permanent) {
      await markEmailSkipped(claimed.id, 'invalid_recipient');
      return;
    }

    await failOrDlq(claimed, errMsg);
  } catch (err: unknown) {
    await failOrDlq(claimed, err instanceof Error ? err.message : String(err));
  }
}
