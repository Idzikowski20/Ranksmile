import { paymentFailedEmailHtml, paymentFailedEmailSubject } from '../../lib/emails/paymentFailedEmail';
import { abandonedCheckoutEmailHtml, ABANDONED_CHECKOUT_SUBJECT } from '../../lib/emails/abandonedCheckoutEmail';
import { starterNudgeEmailHtml, STARTER_NUDGE_SUBJECT } from '../../lib/emails/starterNudgeEmail';
import { inviteEmailHtml } from '../../lib/inviteEmail';
import {
  EMAIL_BG_PAGE,
  EMAIL_CTA_BG,
  EMAIL_FONT,
  EMAIL_RADIUS_BTN,
  defaultEmailLogoUrl,
} from '../../lib/emails/layout';

describe('koala-style transactional emails', () => {
  it('defaultEmailLogoUrl never uses localhost (email clients cannot fetch it)', () => {
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevBase = process.env.APP_BASE_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
    try {
      expect(defaultEmailLogoUrl()).toBe('https://ranksmile.pl/email/ranksmile-logo.png');
    } finally {
      if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevApp;
      if (prevBase === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = prevBase;
    }
  });

  it('payment failed: Koala shell, brand CTA + plan name', () => {
    const html = paymentFailedEmailHtml({
      planName: 'Growth',
      updateUrl: 'https://billing.stripe.com/p/session/test',
    });
    expect(html).toContain(`background-color:${EMAIL_BG_PAGE}`);
    expect(html).toContain(EMAIL_FONT);
    expect(html).not.toContain('box-shadow');
    expect(html).toContain('We couldn\'t process your payment');
    expect(html).toContain('<strong>Growth</strong>');
    expect(html).toContain('Update payment method');
    expect(html).toContain('https://billing.stripe.com/p/session/test');
    expect(html).toContain('max-width:720px');
    expect(html).toContain('alt="Ranksmile"');
    expect(html).toContain(`background:${EMAIL_CTA_BG}`);
    expect(html).toContain(`border-radius:${EMAIL_RADIUS_BTN}`);
    expect(paymentFailedEmailSubject('Growth')).toContain('Growth');
  });

  it('abandoned checkout: growth pitch + brand CTA', () => {
    const html = abandonedCheckoutEmailHtml({
      checkoutUrl: 'https://app.ranksmile.pl/billing/checkout/growth?billing=monthly&mode=trial',
    });
    expect(html).toContain('Hey there!');
    expect(html).toContain('€59/month');
    expect(html).toContain('Return to checkout');
    expect(html).toContain('Growth');
    expect(html).toContain(`background:${EMAIL_CTA_BG}`);
    expect(ABANDONED_CHECKOUT_SUBJECT).toMatch(/Growth/i);
  });

  it('starter nudge: current-dated 3-month story + Growth CTA', () => {
    const html = starterNudgeEmailHtml({
      checkoutUrl: 'https://app.ranksmile.pl/billing/checkout/growth?billing=monthly&mode=trial',
      asOf: new Date('2026-07-27T12:00:00Z'),
    });
    expect(html).toContain('Hey there!');
    expect(html).toContain('April 2026');
    expect(html).toContain('July 2026');
    expect(html).toContain('210+');
    expect(html).toContain('~48/day');
    expect(html).toContain('Grow with the €59 Growth Plan');
    expect(html).toContain('alt="Ranksmile"');
    expect(html).toContain(EMAIL_FONT);
    expect(STARTER_NUDGE_SUBJECT).toMatch(/Growth/i);
  });

  it('invite uses same Koala layout + logo + escape', () => {
    const html = inviteEmailHtml({
      orgName: '<script>x</script>',
      role: 'admin',
      acceptUrl: 'https://app.ranksmile.pl/invite/tok',
      expiresAt: '30 Jun 2026',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Accept invitation');
    expect(html).toContain('max-width:720px');
    expect(html).toContain('https://ranksmile.pl/email/ranksmile-logo.png');
    expect(html).toContain('DM Sans');
  });
});
