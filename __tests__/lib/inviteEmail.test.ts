import { inviteEmailHtml } from '../../lib/inviteEmail';

describe('inviteEmailHtml', () => {
  it('includes the accept url, role and expiry', () => {
    const html = inviteEmailHtml({ orgName: 'Acme', role: 'admin', acceptUrl: 'https://app.example.com/invite/tok123', expiresAt: '3 Jul 2026' });
    expect(html).toContain('https://app.example.com/invite/tok123');
    expect(html).toContain('an admin');
    expect(html).toContain('3 Jul 2026');
    expect(html).toContain('Acme');
  });
  it('escapes html in the org name', () => {
    const html = inviteEmailHtml({ orgName: '<script>', role: 'member', acceptUrl: 'x', expiresAt: 'y' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
