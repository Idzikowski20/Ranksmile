import { commentsUrl } from '../../components/articles/comments/commentApi';

describe('commentsUrl', () => {
  it('builds a tokenless URL for the authenticated owner', () => {
    expect(commentsUrl('5')).toBe('/api/articles/5/comments');
  });

  it('passes through extra params for the authenticated owner', () => {
    expect(commentsUrl('5', { commentId: 'c_1' }))
      .toBe('/api/articles/5/comments?commentId=c_1');
  });
});
