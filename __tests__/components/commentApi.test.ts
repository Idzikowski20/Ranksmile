import { commentsUrl } from '../../components/articles/comments/commentApi';

describe('commentsUrl', () => {
  it('builds a tokenless URL for the authenticated owner', () => {
    expect(commentsUrl('5')).toBe('/api/articles/5/comments');
  });

  it('carries the share token for anonymous reviewers', () => {
    expect(commentsUrl('5', 'tok_abc')).toBe('/api/articles/5/comments?token=tok_abc');
  });

  it('keeps extra params and appends the token', () => {
    expect(commentsUrl('5', 'tok_abc', { commentId: 'c_1' }))
      .toBe('/api/articles/5/comments?commentId=c_1&token=tok_abc');
  });

  it('passes through extra params without a token', () => {
    expect(commentsUrl('5', undefined, { commentId: 'c_1' }))
      .toBe('/api/articles/5/comments?commentId=c_1');
  });
});
