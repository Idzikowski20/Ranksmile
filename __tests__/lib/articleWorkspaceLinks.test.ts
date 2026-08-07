import fs from 'fs';
import path from 'path';
import { buildArticleWorkspaceLinks } from '../../lib/articleWorkspaceLinks';

describe('buildArticleWorkspaceLinks', () => {
  it('scopes article creation and import to the active workspace URL', () => {
    expect(buildArticleWorkspaceLinks(12, 'example-com')).toEqual({
      recommendations: '/workspace/12/sites/example-com/recommendations',
      keyword: '/workspace/12/articles/new',
      import: '/workspace/12/articles/import',
      contentAudit: '/workspace/12/sites/example-com/content-audit',
    });
  });

  it('falls back to the dashboard when no slug is active', () => {
    const links = buildArticleWorkspaceLinks(12, '');
    expect(links.contentAudit).toBe('/workspace/12/dashboard');
  });

  /**
   * The previous version of this file asserted `/sites/articles/new`, which is what the
   * code emitted and what 404'd: `/sites/...` is the per-domain area and always carries a
   * slug, so "articles" was parsed as a domain. Asserting the string the code happened to
   * produce could never catch that — these paths have to be checked against real routes.
   */
  it('points every link at a page that exists', () => {
    const pagesDir = path.join(process.cwd(), 'pages');
    const routeExists = (route: string) => {
      const segments = route.replace(/^\//, '').split('/');
      let dir = pagesDir;
      for (let i = 0; i < segments.length; i += 1) {
        const last = i === segments.length - 1;
        const entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
        const dynamic = entries.find((e) => e.startsWith('['));
        if (last) {
          if (entries.includes(`${segments[i]}.tsx`) || entries.includes(segments[i])) return true;
          return Boolean(dynamic);
        }
        if (entries.includes(segments[i])) {
          dir = path.join(dir, segments[i]);
        } else if (dynamic && fs.statSync(path.join(dir, dynamic)).isDirectory()) {
          dir = path.join(dir, dynamic);
        } else {
          return false;
        }
      }
      return false;
    };

    // Without a workspace prefix the hrefs are plain app routes.
    const links = buildArticleWorkspaceLinks(null, 'example-com');
    for (const route of Object.values(links)) {
      expect({ route, exists: routeExists(route) }).toEqual({ route, exists: true });
    }
  });

  it('catches the regression it was written for', () => {
    expect(buildArticleWorkspaceLinks(null, 'x').keyword).not.toContain('/sites/articles');
  });
});
