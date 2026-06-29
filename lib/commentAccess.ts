import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../utils/getUser';
import { assertArticleAccess, articleIdForShareToken } from './tenancy';

/**
 * Gate for the comment endpoints, which serve two callers: anonymous reviewers holding
 * an article's opaque share token, and the article's authenticated owner. A raw article
 * id is never enough — require a token that resolves to *this* article, or owner access.
 */
export async function assertCommentAccess(req: NextApiRequest, res: NextApiResponse, articleId: number): Promise<boolean> {
   return (await getCommentAccessKind(req, res, articleId)) !== null;
}

/**
 * Like assertCommentAccess but reports WHICH caller it is: 'owner' (authenticated article owner)
 * or 'token' (anonymous reviewer with a valid share token). null = no access. Used to stop
 * anonymous reviewers from editing/deleting the owner's comments.
 */
export async function getCommentAccessKind(
   req: NextApiRequest, res: NextApiResponse, articleId: number,
): Promise<'owner' | 'token' | null> {
   if (!Number.isInteger(articleId)) return null;
   const token = typeof req.query.token === 'string' ? req.query.token : undefined;
   if (token && (await articleIdForShareToken(token)) === articleId) return 'token';
   const userId = await getCurrentUserId(req, res);
   if (userId && (await assertArticleAccess(userId, articleId))) return 'owner';
   return null;
}
