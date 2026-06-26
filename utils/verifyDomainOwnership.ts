import { Op } from 'sequelize';
import Domain from '../database/models/domain';
import { getAccessibleWorkspaceIds } from '../lib/tenancy';

/**
 * Workspace-scoped access check. Authorization lives in the query WHERE clause (a
 * single point), so a row the user may not see is never loaded. Returns the domain
 * if its workspace is accessible, null if it doesn't exist, false if it exists but
 * is denied. The second (existence) query only runs on the deny/not-found path.
 */
export async function verifyDomainOwnership(
   domainName: string,
   userId: string | null,
): Promise<Domain | null | false> {
   const wsIds = await getAccessibleWorkspaceIds(userId);
   const owned = await Domain.findOne({ where: { domain: domainName, workspace_id: { [Op.in]: wsIds } } });
   if (owned) return owned;
   const exists = await Domain.findOne({ where: { domain: domainName }, attributes: ['ID'] });
   return exists ? false : null;
}

/** Same as `verifyDomainOwnership`, but looks the domain up by slug. */
export async function verifyDomainOwnershipBySlug(
   slug: string,
   userId: string | null,
): Promise<Domain | null | false> {
   const wsIds = await getAccessibleWorkspaceIds(userId);
   const owned = await Domain.findOne({ where: { slug, workspace_id: { [Op.in]: wsIds } } });
   if (owned) return owned;
   const exists = await Domain.findOne({ where: { slug }, attributes: ['ID'] });
   return exists ? false : null;
}
