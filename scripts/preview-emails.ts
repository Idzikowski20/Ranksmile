import { writeFileSync } from 'fs';
import { join } from 'path';
import { buildConfirmEmailHtml, CONFIRM_EMAIL_SUBJECT } from '../lib/confirmEmail';
import { inviteEmailHtml } from '../lib/inviteEmail';
import { paymentFailedEmailHtml, paymentFailedEmailSubject } from '../lib/emails/paymentFailedEmail';
import { abandonedCheckoutEmailHtml, ABANDONED_CHECKOUT_SUBJECT } from '../lib/emails/abandonedCheckoutEmail';
import { starterNudgeEmailHtml, STARTER_NUDGE_SUBJECT } from '../lib/emails/starterNudgeEmail';
import { buildGscDigest } from '../lib/gscDigestEmail';

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const emails = [
  {
    id: 'confirm',
    subject: CONFIRM_EMAIL_SUBJECT,
    html: buildConfirmEmailHtml('https://ranksmile.pl/auth/confirm-email?token=demo'),
  },
  {
    id: 'invite',
    subject: "You've been invited to join Acme — Ranksmile",
    html: inviteEmailHtml({
      orgName: 'Acme',
      role: 'admin',
      acceptUrl: 'https://ranksmile.pl/invite/demo',
      expiresAt: '30 Aug 2026',
    }),
  },
  {
    id: 'payment-failed',
    subject: paymentFailedEmailSubject('Growth'),
    html: paymentFailedEmailHtml({
      planName: 'Growth',
      updateUrl: 'https://billing.stripe.com/p/session/demo',
    }),
  },
  {
    id: 'abandoned',
    subject: ABANDONED_CHECKOUT_SUBJECT,
    html: abandonedCheckoutEmailHtml({
      checkoutUrl: 'https://ranksmile.pl/billing/checkout/growth',
    }),
  },
  {
    id: 'starter-nudge',
    subject: STARTER_NUDGE_SUBJECT,
    html: starterNudgeEmailHtml({
      checkoutUrl: 'https://ranksmile.pl/billing/checkout/growth',
      asOf: new Date('2026-08-04T12:00:00Z'),
    }),
  },
  {
    id: 'gsc-digest',
    subject: 'Weekly Ranksmile Performance',
    html: buildGscDigest({
      domains: [{
        domain: 'example.com',
        summary: {
          clicks: 80,
          prevClicks: 100,
          impressions: 900,
          prevImpressions: 1000,
          pagesFell: 2,
          pagesGrew: 1,
        },
        tiers: {
          droppedInTop10: [{ page: '/oferta', prevPos: 4, nowPos: 9, clicks: 5, prevClicks: 20 }],
          droppedATier: [],
          outOfIndex: [{ page: '/blog/x', prevPos: 12, nowPos: null, clicks: 0, prevClicks: 3 }],
          growth: [{ page: '/guide', prevPos: 15, nowPos: 8, clicks: 12, prevClicks: 4 }],
        },
      }],
    }),
  },
];

const nav = emails
  .map((e) => `<a href="#${e.id}" style="color:#f84416;text-decoration:none;margin-right:16px;font-weight:500;">${e.id}</a>`)
  .join('');

const sections = emails.map((e) => `
<section id="${e.id}" style="margin:0 0 48px;">
  <div style="margin-bottom:12px;">
    <div style="font-size:12px;color:#767676;text-transform:uppercase;letter-spacing:0.04em;">${e.id}</div>
    <div style="font-size:18px;font-weight:700;color:#1a1a1a;margin-top:4px;">${escAttr(e.subject)}</div>
  </div>
  <iframe srcdoc="${escAttr(e.html)}" style="width:100%;height:820px;border:1px solid #e5e5e5;border-radius:16px;background:#fff;"></iframe>
</section>`).join('\n');

const out = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<title>Ranksmile email preview</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet"/>
<style>
  body{margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;background:#f5f5f5;color:#1a1a1a}
  .wrap{max-width:880px;margin:0 auto;padding:32px 20px}
</style>
</head>
<body>
<div class="wrap">
  <h1 style="font-size:28px;font-weight:700;margin:0 0 8px;">Ranksmile — wszystkie maile</h1>
  <p style="color:#575757;margin:0 0 24px;">Koala UI preview · ${emails.length} szablonów</p>
  <nav style="margin-bottom:40px;padding-bottom:16px;border-bottom:1px solid #e5e5e5;">${nav}</nav>
  ${sections}
</div>
</body>
</html>`;

const path = join(process.cwd(), 'tmp-email-preview.html');
writeFileSync(path, out, 'utf8');
console.log(path);
