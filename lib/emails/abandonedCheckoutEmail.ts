import {
  emailBody,
  emailCta,
  emailRow,
  emailSupportLine,
  wrapEmail,
} from './layout';

export const ABANDONED_CHECKOUT_SUBJECT = 'Still thinking it over? Start with Starter — Ranksmile';

export function abandonedCheckoutEmailHtml(p: {
  checkoutUrl: string;
  starterPriceMonthly?: number;
}): string {
  const price = p.starterPriceMonthly ?? 29;
  const rows = [
    emailRow(emailBody('Hey there!')),
    emailRow(emailBody(
      'We saw you were checking out but didn\'t finish your purchase. If cost was a factor, we totally get it — and we have a plan that fits.',
    )),
    emailRow(emailBody(
      `Our <strong>Starter</strong> plan is just <strong>$${price}/month</strong>, giving you everything you need to start optimizing content and improving SEO without stretching the budget.`,
    )),
    emailRow(emailBody('It\'s built for creators, marketers, and teams who want to grow without a big upfront investment.')),
    emailRow(emailBody('Want to give it a try?', { bold: true })),
    emailRow(emailCta('Return to checkout — Starter plan', p.checkoutUrl)),
    emailRow(emailBody('Let us know if you have any questions — we\'re here to help!')),
    emailRow(emailSupportLine()),
  ].join('\n');
  return wrapEmail(rows);
}
