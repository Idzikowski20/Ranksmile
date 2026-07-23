/** Scopes requested by /api/gsc/connect (GSC read + GBP manage). */
export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/business.manage',
] as const;

export const GBP_MANAGE_SCOPE = 'https://www.googleapis.com/auth/business.manage';

export function hasGbpManageScope(scopes: string): boolean {
  if (!scopes) return false;
  const parts = scopes.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  return parts.includes(GBP_MANAGE_SCOPE)
    || parts.includes('https://www.googleapis.com/auth/plus.business.manage');
}
