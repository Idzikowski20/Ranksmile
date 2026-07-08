import { workspaceHref } from './activeWorkspace';

export type ArticleWorkspaceLinks = {
   recommendations: string;
   keyword: string;
   import: string;
   contentAudit: string;
   topicalMap: string;
};

export function buildArticleWorkspaceLinks(wsId: number | null | undefined, activeSlug: string): ArticleWorkspaceLinks {
   return {
      recommendations: activeSlug ? workspaceHref(wsId, `/sites/${activeSlug}/recommendations`) : workspaceHref(wsId, '/dashboard'),
      keyword: workspaceHref(wsId, '/sites/articles/new'),
      import: workspaceHref(wsId, '/sites/articles/import'),
      contentAudit: activeSlug ? workspaceHref(wsId, `/sites/${activeSlug}/content-audit`) : workspaceHref(wsId, '/dashboard'),
      topicalMap: activeSlug ? workspaceHref(wsId, `/sites/${activeSlug}/topical-map`) : workspaceHref(wsId, '/dashboard'),
   };
}
