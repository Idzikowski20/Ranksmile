// Confirmation e-mail for the confirm-account flow. Transport = Resend HTTP API (no SDK, plain
// fetch) — the app's SMTP path (lib/sendMail) is settings-table driven and unset on fresh installs,
// while registration mail must always work. Sender domain is the Resend-verified one.
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM = 'Surfy <noreply@elearning.riskcom.pl>';
export const CONFIRM_EMAIL_SUBJECT = 'Confirm your e-mail — Surfy';

const F = 'Inter, Helvetica, Arial, sans-serif';

/** Surfer-style confirmation mail ("You're a click away"). Pure — no I/O. */
export function buildConfirmEmailHtml(confirmUrl: string): string {
  return `<div lang="en-us" style="background-color:#ffffff;">
  <div style="margin:0 auto;max-width:600px;padding:32px;">
    <div style="max-width:536px;margin:0 auto;text-align:left;">
      <div style="font-family:${F};font-size:16px;font-weight:700;color:#000000;">Surfy</div>
      <div style="font-family:${F};font-size:30px;font-weight:600;line-height:38px;color:#000000;padding-top:32px;">You're a click away</div>
      <div style="font-family:${F};font-size:16px;font-weight:400;line-height:26px;color:#000000;padding-top:32px;">Hit the button to verify your email. You're just a few steps away from skyrocketing your organic traffic!</div>
      <div style="padding-top:32px;">
        <a href="${confirmUrl}" target="_blank" style="display:inline-block;background:#222A3A;color:#ffffff;font-family:${F};font-size:16px;font-weight:600;line-height:24px;text-decoration:none;padding:8px 24px;border-radius:8px;">Confirm my email address</a>
      </div>
      <div style="font-family:${F};font-size:16px;font-weight:700;line-height:26px;color:#000000;padding-top:32px;">This email will self-destruct in 30 minutes.</div>
      <div style="font-family:${F};font-size:16px;font-weight:400;line-height:26px;color:#000000;padding-top:32px;">Didn't ask for this email? Just ignore me.</div>
      <div style="font-family:${F};font-size:16px;font-weight:400;line-height:26px;color:#000000;padding-top:32px;">If you need assistance, contact us at <a href="mailto:support@elearning.riskcom.pl" style="color:#222A3A;">support@elearning.riskcom.pl</a>.</div>
    </div>
  </div>
</div>`;
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
