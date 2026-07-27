// Confirmation e-mail for the confirm-account flow. Transport = Resend HTTP API (no SDK, plain
// fetch) — the app's SMTP path (lib/sendMail) is settings-table driven and unset on fresh installs,
// while registration mail must always work. Sender domain is the Resend-verified one.
import {
  emailBody,
  emailCta,
  emailHeadline,
  emailRow,
  emailSupportLine,
  wrapEmail,
} from './emails/layout';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Ranksmile <noreply@ranksmile.pl>';
const FROM = (process.env.RESEND_FROM || DEFAULT_FROM).trim();
export const CONFIRM_EMAIL_SUBJECT = 'Confirm your e-mail — Ranksmile';

/** Ranksmile confirmation mail ("You're a click away"). Pure — no I/O. */
export function buildConfirmEmailHtml(confirmUrl: string): string {
  const rows = [
    emailRow(emailHeadline('You\'re a click away')),
    emailRow(emailBody(
      'Hit the button to verify your email. You\'re just a few steps away from skyrocketing your organic traffic!',
    )),
    emailRow(emailCta('Confirm my email address', confirmUrl)),
    emailRow(emailBody('This email will self-destruct in 30 minutes.', { bold: true })),
    emailRow(emailBody('Didn\'t ask for this email? Just ignore me.')),
    emailRow(emailSupportLine()),
  ].join('\n');
  return wrapEmail(rows);
}

/** Send via Resend. { sent:false } (never throws) when the key is missing or the API errors. */
export async function sendConfirmationEmail(email: string, confirmUrl: string): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_APIKEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[confirmEmail] RESEND_APIKEY is not set — confirmation e-mail not sent.');
    return { sent: false };
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [email], subject: CONFIRM_EMAIL_SUBJECT, html: buildConfirmEmailHtml(confirmUrl) }),
    });
    if (!res.ok) {
      console.warn(`[confirmEmail] Resend responded ${res.status} — confirmation e-mail not sent.`);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.warn('[confirmEmail] Resend request failed:', err);
    return { sent: false };
  }
}
