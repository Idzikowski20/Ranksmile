import {
  emailBody,
  emailCta,
  emailHeadline,
  emailRow,
  emailSupportLine,
  escapeHtml,
  wrapEmail,
} from './layout';

export function paymentFailedEmailHtml(p: {
  planName: string;
  updateUrl: string;
}): string {
  const plan = escapeHtml(p.planName);
  const rows = [
    emailRow(emailBody('Hey there!')),
    emailRow(emailHeadline('We couldn\'t process your payment')),
    emailRow(emailBody(
      `Your Ranksmile <strong>${plan}</strong> subscription payment failed. Update your card so you don't lose access to documents, AI visibility, and audits.`,
    )),
    emailRow(emailBody('We\'ll retry automatically, but updating billing details now is the fastest fix.')),
    emailRow(emailCta('Update payment method', p.updateUrl)),
    emailRow(emailBody('If you already fixed this, you can ignore this email.')),
    emailRow(emailSupportLine()),
  ].join('\n');
  return wrapEmail(rows);
}

export function paymentFailedEmailSubject(planName: string): string {
  return `Payment failed for your Ranksmile ${planName} plan`;
}
