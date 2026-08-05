import { getAppOrigin } from '../appOrigin';
import { sendMail } from '../sendMail';
import { STARTER_NUDGE_SUBJECT, starterNudgeEmailHtml } from './starterNudgeEmail';

/** One-shot free→paid Growth pitch (cron). Uses shared sendMail (Resend/SMTP). */
export async function sendStarterNudgeEmail(to: string): Promise<{ sent: boolean }> {
  const checkoutUrl = `${getAppOrigin()}/billing/checkout/growth?billing=monthly&mode=trial`;
  const result = await sendMail({
    to,
    subject: STARTER_NUDGE_SUBJECT,
    html: starterNudgeEmailHtml({ checkoutUrl }),
  });
  return { sent: result.sent };
}
