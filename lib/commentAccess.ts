import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../utils/getUser';
import { assertArticleAccess } from './tenancy';

/** Owner-only gate for article comment endpoints. */
export async function assertCommentAccess(req: NextApiRequest, res: NextApiResponse, articleId: number): Promise<boolean> {
   return (await getCommentAccessKind(req, res, articleId)) !== null;
}

/** Returns 'owner' when the caller owns the article, otherwise null. */
export async function getCommentAccessKind(
   req: NextApiRequest, res: NextApiResponse, articleId: number,
): Promise<'owner' | null> {
   if (!Number.isInteger(articleId)) return null;
   const userId = await getCurrentUserId(req, res);
   if (userId && (await assertArticleAccess(userId, articleId))) return 'owner';
   return null;
}
