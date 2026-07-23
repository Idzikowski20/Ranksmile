import { upgradeGoogleImageUrl } from '../../lib/local/googleBusinessInfo';

describe('googleBusinessInfo', () => {
  it('upgrades tiny Google logo URLs to a usable size', () => {
    const tiny = 'https://lh3.googleusercontent.com/-abc/AAAAAAAAAAI/AAAAAAAAAAA/xyz/s44-p-k-no-ns-nd/photo.jpg';
    expect(upgradeGoogleImageUrl(tiny, 512)).toContain('/s512-');
  });

  it('upgrades main image width/height params', () => {
    const main = 'https://lh3.googleusercontent.com/gps-cs-s/ABC=w408-h271-k-no';
    expect(upgradeGoogleImageUrl(main)).toContain('=w1200-h900-k-no');
  });
});
