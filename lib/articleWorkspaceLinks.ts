import { workspaceHref } from './activeWorkspace';

export type ArticleWorkspaceLinks = {
   recommendations: string;
   keyword: string;
   import: string;
   contentAudit: string;
};

/**
 * `/sites/...` is the per-domain area and always carries a slug (`/sites/<slug>/...`).
 * The article entry points live at the top level instead, so prefixing them produced
 * `/sites/articles/new`, which resolves `[domain]` to the literal "articles" and 404s.
 */
export function buildArticleWorkspaceLinks(wsId: number | null | undefined, activeSlug: string): ArticleWorkspaceLinks {
   return {
      recommendations: activeSlug ? workspaceHref(wsId, `/sites/${activeSlug}/recommendations`) : workspaceHref(wsId, '/dashboard'),
      keyword: workspaceHref(wsId, '/articles/new'),
      import: workspaceHref(wsId, '/articles/import'),
      contentAudit: activeSlug ? workspaceHref(wsId, `/sites/${activeSlug}/content-audit`) : workspaceHref(wsId, '/dashboard'),
   };
}
