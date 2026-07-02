import { buildConfirmEmailHtml, sendConfirmationEmail, CONFIRM_EMAIL_SUBJECT } from '../../lib/confirmEmail';

describe('buildConfirmEmailHtml', () => {
   const confirmUrl = 'https://app.example.com/auth/confirm-email?token=tok123';
   const escapedUrl = confirmUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

   it('includes the confirm url exactly once, in the CTA href', () => {
      const html = buildConfirmEmailHtml(confirmUrl);
      const hrefMatches = html.match(new RegExp(`href="${escapedUrl}"`, 'g'));
      expect(hrefMatches?.length).toBe(1);
      const anyMatches = html.match(new RegExp(escapedUrl, 'g'));
      expect(anyMatches?.length).toBe(1);
   });

   it('uses the Surfer confirmation copy (30-minute self-destruct, CTA label, heading)', () => {
      const html = buildConfirmEmailHtml(confirmUrl);
      expect(html).toContain("You're a click away");
      expect(html).toContain('Confirm my email address');
      expect(html).toContain('This email will self-destruct in 30 minutes.');
      expect(html).not.toContain('24 hours');
   });

   it('has no unresolved template placeholders', () => {
      const html = buildConfirmEmailHtml(confirmUrl);
      expect(html).not.toContain('${');
   });
});

describe('sendConfirmationEmail', () => {
   const confirmUrl = 'https://app.example.com/auth/confirm-email?token=tok123';
   const origKey = process.env.RESEND_APIKEY;
   const origAltKey = process.env.RESEND_API_KEY;
   let fetchSpy: jest.SpyInstance;

   beforeEach(() => {
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response);
      fetchSpy.mockClear();
      jest.spyOn(console, 'warn').mockImplementation(() => {});
   });
   afterEach(() => {
      jest.restoreAllMocks();
      process.env.RESEND_APIKEY = origKey;
      process.env.RESEND_API_KEY = origAltKey;
      if (origKey === undefined) delete process.env.RESEND_APIKEY;
      if (origAltKey === undefined) delete process.env.RESEND_API_KEY;
   });

   it('POSTs to Resend with the key, verified from-domain, recipient and subject', async () => {
      process.env.RESEND_APIKEY = 'test-key';
      const result = await sendConfirmationEmail('user@example.com', confirmUrl);
      expect(result).toEqual({ sent: true });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect(init.headers.Authorization).toBe('Bearer test-key');
      const body = JSON.parse(init.body);
      expect(body.from).toContain('elearning.riskcom.pl');
      expect(body.to).toEqual(['user@example.com']);
      expect(body.subject).toBe(CONFIRM_EMAIL_SUBJECT);
      expect(body.html).toContain(confirmUrl);
   });

   it('returns { sent:false } on a non-2xx Resend response', async () => {
      process.env.RESEND_APIKEY = 'test-key';
      fetchSpy.mockResolvedValue({ ok: false, status: 500 } as Response);
      const result = await sendConfirmationEmail('user@example.com', confirmUrl);
      expect(result).toEqual({ sent: false });
   });

   it('returns { sent:false } without calling fetch when the API key is missing', async () => {
      delete process.env.RESEND_APIKEY;
      delete process.env.RESEND_API_KEY;
      const result = await sendConfirmationEmail('user@example.com', confirmUrl);
      expect(result).toEqual({ sent: false });
      expect(fetchSpy).not.toHaveBeenCalled();
   });
});
