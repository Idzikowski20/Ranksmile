import { buildArticleWorkspaceLinks } from '../../lib/articleWorkspaceLinks';

describe('buildArticleWorkspaceLinks', () => {
  it('scopes article creation and import to the active workspace URL', () => {
    expect(buildArticleWorkspaceLinks(12, 'example-com')).toEqual({
      recommendations: '/workspace/12/sites/example-com/recommendations',
      keyword: '/workspace/12/sites/articles/new',
      import: '/workspace/12/sites/articles/import',
      contentAudit: '/workspace/12/sites/content_audit',
      topicalMap: '/workspace/12/sites/topical-map',
    });
  });
});
