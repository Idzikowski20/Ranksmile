import { normalizeKeywords, MAX_KEYWORDS_PER_SCHEDULE } from '@/src/core/domain/automations/keywords';

describe('normalizeKeywords', () => {
  it('trims, drops empties and collapses inner whitespace', () => {
    expect(normalizeKeywords(['  local  seo ', '', '   ', 'seo tips'])).toEqual(['local seo', 'seo tips']);
  });

  it('dedupes case-insensitively, keeping the first spelling', () => {
    expect(normalizeKeywords(['Local SEO', 'local seo', 'LOCAL SEO '])).toEqual(['Local SEO']);
  });

  it('ignores non-string entries and non-array input', () => {
    expect(normalizeKeywords(['ok', 42, null, { k: 1 }])).toEqual(['ok']);
    expect(normalizeKeywords('ok')).toEqual([]);
    expect(normalizeKeywords(undefined)).toEqual([]);
  });

  it('caps each keyword at 200 characters and the list at the per-schedule maximum', () => {
    expect(normalizeKeywords(['x'.repeat(250)])[0]).toHaveLength(200);
    const many = Array.from({ length: MAX_KEYWORDS_PER_SCHEDULE + 5 }, (_, i) => `kw ${i}`);
    expect(normalizeKeywords(many)).toHaveLength(MAX_KEYWORDS_PER_SCHEDULE);
  });
});
