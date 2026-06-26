import { parseDataUrl } from '../../lib/uploadToBlob';

describe('parseDataUrl', () => {
  it('decodes a valid base64 image data URL', () => {
    const png = Buffer.from('hello').toString('base64');
    const res = parseDataUrl(`data:image/png;base64,${png}`);
    expect(res).not.toBeNull();
    expect(res!.contentType).toBe('image/png');
    expect(res!.buffer.toString()).toBe('hello');
  });
  it('returns null for a non-data-url string', () => {
    expect(parseDataUrl('https://x.com/a.png')).toBeNull();
  });
  it('returns null for a non-image data URL', () => {
    expect(parseDataUrl('data:text/plain;base64,aGk=')).toBeNull();
  });
  it('decodes a gif data URL', () => {
    const res = parseDataUrl(`data:image/gif;base64,${Buffer.from('GIF89a').toString('base64')}`);
    expect(res?.contentType).toBe('image/gif');
    expect(res?.buffer.toString()).toBe('GIF89a');
  });
  it('does not overflow the regex stack on a multi-MB payload', () => {
    const big = 'A'.repeat(6 * 1024 * 1024); // ~6 MB of valid base64 chars
    expect(() => parseDataUrl(`data:image/webp;base64,${big}`)).not.toThrow();
    expect(parseDataUrl(`data:image/webp;base64,${big}`)?.contentType).toBe('image/webp');
  });
  it('returns null for a data URL without ;base64', () => {
    expect(parseDataUrl('data:image/png,rawsvgdata')).toBeNull();
  });
});
