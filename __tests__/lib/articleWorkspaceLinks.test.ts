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
    const PAGE_EXT = ['.tsx', '.ts', '.jsx', '.js'];
    const isDir = (p: string) => fs.existsSync(p) && fs.statSync(p).isDirectory();

    /**
     * A final segment only resolves if it lands on a real page module: `seg.tsx`, or
     * `seg/index.tsx`. Accepting a bare directory (what this used to do) would pass a
     * route that Next.js 404s, which is the exact class of bug this test exists to catch.
     */
    const resolvesToPage = (dir: string, seg: string) => PAGE_EXT.some((ext) => fs.existsSync(path.join(dir, `${seg}${ext}`)))
      || (isDir(path.join(dir, seg))
        && PAGE_EXT.some((ext) => fs.existsSync(path.join(dir, seg, `index${ext}`))));

    const routeExists = (route: string) => {
      const segments = route.replace(/^\//, '').split('/');
      let dir = pagesDir;
      for (let i = 0; i < segments.length; i += 1) {
        const last = i === segments.length - 1;
        const entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
        const dynamic = entries.find((e) => e.startsWith('['));
        if (last) {
          if (resolvesToPage(dir, segments[i])) return true;
          // A dynamic entry may be `[id].tsx` or an `[id]/` folder — both reduce to `[id]`.
          const dynamicSeg = dynamic?.replace(/\.(tsx|ts|jsx|js)$/, '');
          return Boolean(dynamicSeg && resolvesToPage(dir, dynamicSeg));
        }
        if (isDir(path.join(dir, segments[i]))) {
          dir = path.join(dir, segments[i]);
        } else if (dynamic && isDir(path.join(dir, dynamic))) {
          dir = path.join(dir, dynamic);
        } else {
          return false;
        }
      }
      return false;
    };

    // The helper must reject a directory that has no index page, or it proves nothing.
    expect(routeExists('/sites')).toBe(false);

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
