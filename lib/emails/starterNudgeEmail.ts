import {
  emailBody,
  emailCta,
  emailRow,
  emailSupportLine,
  escapeHtml,
  wrapEmail,
} from './layout';

export const STARTER_NUDGE_SUBJECT = 'Grow with the Ranksmile Starter plan';

function formatStoryMonth(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** ~3 months before `now` (same calendar day when possible). */
function monthsAgo(now: Date, months: number): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

export function starterNudgeEmailHtml(p: {
  checkoutUrl: string;
  storyUrl?: string;
  starterPriceMonthly?: number;
  /** Anchor date for the case study (defaults to now). */
  asOf?: Date;
}): string {
  const price = p.starterPriceMonthly ?? 29;
  const asOf = p.asOf ?? new Date();
  const started = monthsAgo(asOf, 3);
  const startedLabel = formatStoryMonth(started);
  const resultLabel = formatStoryMonth(asOf);
  const storyHref = p.storyUrl ?? 'https://ranksmile.pl';
  const storyLink = `<a href="${escapeHtml(storyHref)}" style="color:#222a3a" target="_blank">success story</a>`;
  const rows = [
    emailRow(emailBody('Hey there!')),
    emailRow(emailBody(`Ready to grow with Ranksmile? Here's a ${storyLink} from teams like yours.`)),
    emailRow(emailBody(
      `In ${startedLabel}, an SEO consultant onboarded a client with thin blog content, almost no page-one rankings, and roughly a dozen organic clicks a day.`,
    )),
    emailRow(emailBody(`About three months later with Ranksmile (${resultLabel}):`)),
    emailRow(emailBody(
      '<ul style="margin:0;padding-left:20px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:16px;line-height:26px;color:#222a3a">'
      + '<li>Keywords in the top 20 grew from ~45 to 210+</li>'
      + '<li>Organic clicks rose from ~12/day to ~48/day</li>'
      + '<li>18 optimized articles shipped; 5 pages reached page one</li>'
      + '</ul>',
    )),
    emailRow(emailBody('Ready to experience similar results for your business?', { bold: true })),
    emailRow(emailCta(`Grow with the $${price} Starter Plan`, p.checkoutUrl)),
    emailRow(emailBody('Let us know if you have any questions. We\'re here to assist!')),
    emailRow(emailSupportLine()),
  ].join('\n');
  return wrapEmail(rows);
}
