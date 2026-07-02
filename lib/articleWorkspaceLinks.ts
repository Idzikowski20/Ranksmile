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
      recommendations: activeSlug ? workspaceHref(wsId, `/sites/${activeSlug}/recommendations`) : workspaceHref(wsId, '/sites'),
      keyword: workspaceHref(wsId, '/sites/articles/new'),
      import: workspaceHref(wsId, '/sites/articles/import'),
      contentAudit: workspaceHref(wsId, '/sites/content_audit'),
      topicalMap: workspaceHref(wsId, '/sites/topical-map'),
   };
}
