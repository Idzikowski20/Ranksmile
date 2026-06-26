import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../utils/getUser';
import { assertArticleAccess, articleIdForShareToken } from './tenancy';

/**
 * Gate for the comment endpoints, which serve two callers: anonymous reviewers holding
 * an article's opaque share token, and the article's authenticated owner. A raw article
 * id is never enough — require a token that resolves to *this* article, or owner access.
 */
export async function assertCommentAccess(req: NextApiRequest, res: NextApiResponse, articleId: number): Promise<boolean> {
   if (!Number.isInteger(articleId)) return false;
   const token = typeof req.query.token === 'string' ? req.query.token : undefined;
   if (token && (await articleIdForShareToken(token)) === articleId) return true;
   const userId = await getCurrentUserId(req, res);
   return !!userId && assertArticleAccess(userId, articleId);
}
