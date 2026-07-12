import { isDictionaryQueryNoise } from '../../lib/termUtils';
import { resolveAnalysisSeedKeyword } from '../../lib/inferPageKeyword';

describe('isDictionaryQueryNoise', () => {
  it('rejects Polish dictionary-query spam', () => {
    expect(isDictionaryQueryNoise('co to znaczy inwigilacja')).toBe(true);
    expect(isDictionaryQueryNoise('67 co to znaczy')).toBe(true);
    expect(isDictionaryQueryNoise('znaczy')).toBe(true);
    expect(isDictionaryQueryNoise('prywatny detektyw warszawa')).toBe(false);
  });
});

describe('resolveAnalysisSeedKeyword', () => {
  it('prefers URL slug over off-topic GSC candidate', () => {
    const seed = resolveAnalysisSeedKeyword({
      candidate: 'cuckolding co znaczy',
      pageUrl: 'https://prodetektyw.pl/prywatny-detektyw-warszawa',
      userKeywords: [],
    });
    expect(seed).toBe('prywatny detektyw warszawa');
  });

  it('keeps user seed when provided', () => {
    expect(resolveAnalysisSeedKeyword({
      candidate: 'cuckolding',
      pageUrl: 'https://prodetektyw.pl/prywatny-detektyw-warszawa',
      userKeywords: ['detektyw'],
    })).toBe('detektyw');
  });
});
