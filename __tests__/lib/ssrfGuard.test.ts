import { isPrivateAddress, assertPublicUrl, ssrfSafeFetch } from '../../lib/ssrfGuard';

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1'])(
    'flags private/reserved IPv4 %s', (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34'])('allows public IPv4 %s', (ip) => expect(isPrivateAddress(ip)).toBe(false));
  it('flags IPv6 loopback and unique-local', () => {
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fc00::1')).toBe(true);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
  });
  it('blocks non-IP garbage', () => expect(isPrivateAddress('not-an-ip')).toBe(true));
});

describe('assertPublicUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow();
    await expect(assertPublicUrl('data:text/html,<script>')).rejects.toThrow();
  });
  it('rejects localhost host', async () => {
    await expect(assertPublicUrl('http://localhost/x')).rejects.toThrow();
  });
  it('rejects literal private / metadata IPs (no DNS needed)', async () => {
    await expect(assertPublicUrl('http://127.0.0.1/')).rejects.toThrow();
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow();
    await expect(assertPublicUrl('http://10.0.0.5:9200/')).rejects.toThrow();
  });
  it('accepts a public literal IP', async () => {
    await expect(assertPublicUrl('http://8.8.8.8/')).resolves.toBeInstanceOf(URL);
  });
  it('rejects malformed URLs', async () => {
    await expect(assertPublicUrl('not a url')).rejects.toThrow();
  });
});

describe('ssrfSafeFetch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('blocks redirects that land on private IPs', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 302,
      headers: { get: (k: string) => (k.toLowerCase() === 'location' ? 'http://127.0.0.1:3000/' : null) },
    }) as unknown as typeof fetch;

    await expect(ssrfSafeFetch('http://8.8.8.8/start')).rejects.toThrow(/Blocked|private/i);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://8.8.8.8/start',
      expect.objectContaining({ redirect: 'manual' }),
    );
  });
});
