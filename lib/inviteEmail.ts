import {
  emailBody,
  emailCta,
  emailHeadline,
  emailLink,
  emailRow,
  emailSupportLine,
  escapeHtml,
  wrapEmail,
} from './emails/layout';

export function inviteEmailHtml(p: {
  orgName: string;
  role: string;
  acceptUrl: string;
  expiresAt: string;
}): string {
  const article = /^[aeiou]/i.test(p.role) ? 'an' : 'a';
  const org = escapeHtml(p.orgName);
  const role = escapeHtml(p.role);
  const rows = [
    emailRow(emailHeadline(`You've been invited to join ${org}`)),
    emailRow(emailBody(`Click the button below to accept the invitation and join as ${article} ${role}:`)),
    emailRow(emailCta('Accept invitation', p.acceptUrl)),
    emailRow(emailBody('If you\'re having trouble with the button above, copy and paste the URL below into your web browser:')),
    emailRow(emailBody(emailLink(p.acceptUrl))),
    emailRow(emailBody(`The link is valid until ${escapeHtml(p.expiresAt)}.`, { bold: true })),
    emailRow(emailBody('If you weren\'t expecting this invitation, you can disregard this email.')),
    emailRow(emailSupportLine()),
  ].join('\n');
  return wrapEmail(rows);
}
