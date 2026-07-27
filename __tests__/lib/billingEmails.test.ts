import { paymentFailedEmailHtml, paymentFailedEmailSubject } from '../../lib/emails/paymentFailedEmail';
import { abandonedCheckoutEmailHtml, ABANDONED_CHECKOUT_SUBJECT } from '../../lib/emails/abandonedCheckoutEmail';
import { starterNudgeEmailHtml, STARTER_NUDGE_SUBJECT } from '../../lib/emails/starterNudgeEmail';
import { inviteEmailHtml } from '../../lib/inviteEmail';

describe('surfer-style transactional emails', () => {
  it('payment failed: white shell, no card border, CTA + plan name', () => {
    const html = paymentFailedEmailHtml({
      planName: 'Growth',
      updateUrl: 'https://billing.stripe.com/p/session/test',
    });
    expect(html).toContain('background-color:#ffffff');
    expect(html).not.toContain('box-shadow');
    expect(html).not.toContain('border:1px solid');
    expect(html).toContain('We couldn\'t process your payment');
    expect(html).toContain('<strong>Growth</strong>');
    expect(html).toContain('Update payment method');
    expect(html).toContain('https://billing.stripe.com/p/session/test');
    expect(html).toContain('max-width:720px');
    expect(html).toContain('alt="Ranksmile"');
    expect(paymentFailedEmailSubject('Growth')).toContain('Growth');
  });

  it('abandoned checkout: starter pitch + CTA', () => {
    const html = abandonedCheckoutEmailHtml({
      checkoutUrl: 'https://app.ranksmile.pl/billing/checkout/starter?billing=monthly&mode=trial',
    });
    expect(html).toContain('Hey there!');
    expect(html).toContain('$29/month');
    expect(html).toContain('Return to checkout');
    expect(html).toContain('Starter');
    expect(html).toContain('background:#222a3a');
    expect(ABANDONED_CHECKOUT_SUBJECT).toMatch(/Starter/i);
  });

  it('starter nudge: current-dated 3-month story + CTA', () => {
    const html = starterNudgeEmailHtml({
      checkoutUrl: 'https://app.ranksmile.pl/billing/checkout/starter?billing=monthly&mode=trial',
      asOf: new Date('2026-07-27T12:00:00Z'),
    });
    expect(html).toContain('Hey there!');
    expect(html).toContain('April 2026');
    expect(html).toContain('July 2026');
    expect(html).toContain('210+');
    expect(html).toContain('~48/day');
    expect(html).toContain('Grow with the $29 Starter Plan');
    expect(html).toContain('alt="Ranksmile"');
    expect(STARTER_NUDGE_SUBJECT).toMatch(/Starter/i);
  });

  it('invite uses same white layout + logo + escape', () => {
    const html = inviteEmailHtml({
      orgName: '<script>x</script>',
      role: 'admin',
      acceptUrl: 'https://app.ranksmile.pl/invite/tok',
      expiresAt: '30 Jun 2026',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Accept invitation');
    expect(html).toContain('background-color:#ffffff');
    expect(html).toContain('max-width:720px');
    expect(html).toContain('ranksmile-logo.png');
  });
});
