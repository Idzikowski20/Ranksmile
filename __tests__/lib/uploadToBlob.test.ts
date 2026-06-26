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
});
