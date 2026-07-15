import { resolveArticleEntry, articleEntryHref } from '../../lib/articleFlow';

describe('resolveArticleEntry', () => {
  it('returns generating when status is generating', () => {
    expect(resolveArticleEntry({ status: 'generating', content: '', wizard_state: null })).toEqual({ kind: 'generating' });
  });

  it('returns wizard step when wizard_state set and content empty', () => {
    expect(resolveArticleEntry({
      status: 'draft',
      content: '',
      wizard_state: JSON.stringify({ step: 'context' }),
    })).toEqual({ kind: 'wizard', step: 'context' });
  });

  it('defaults wizard step to content-type on invalid JSON', () => {
    expect(resolveArticleEntry({ status: 'draft', content: '', wizard_state: 'not-json' })).toEqual({ kind: 'wizard', step: 'content-type' });
  });

  it('returns editor when content exists', () => {
    expect(resolveArticleEntry({ status: 'draft', content: '<p>Hi</p>', wizard_state: '{"step":"context"}' })).toEqual({ kind: 'editor' });
  });
});

describe('articleEntryHref', () => {
  it('builds generating href', () => {
    expect(articleEntryHref(42, { kind: 'generating' })).toBe('/articles/generating?articleId=42');
  });

  it('builds wizard href', () => {
    expect(articleEntryHref(42, { kind: 'wizard', step: 'writing-mode' })).toBe('/articles/writing-mode?articleId=42');
  });

  it('returns null for editor', () => {
    expect(articleEntryHref(42, { kind: 'editor' })).toBeNull();
  });
});
