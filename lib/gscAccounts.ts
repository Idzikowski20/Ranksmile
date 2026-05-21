import Cryptr from 'cryptr';
import { auth } from '@googleapis/searchconsole';
import GscAccount from '../database/models/gscAccount';

export type GscAccountRecord = {
  ID: number;
  userId: string;
  google_sub: string;
  email: string;
  refresh_token: string;
  picture: string;
  connected_at: string;
  scopes: string;
};

const decryptToken = (value: string) => {
  const cryptr = new Cryptr(process.env.SECRET as string);
  return cryptr.decrypt(value);
};

const encryptToken = (value: string) => {
  const cryptr = new Cryptr(process.env.SECRET as string);
  return cryptr.encrypt(value);
};

export const getAccountsForUser = async (userId: string) => {
  const rows = await GscAccount.findAll({ where: { userId }, order: [['connected_at', 'DESC'], ['ID', 'DESC']] });
  return rows.map((row) => row.get({ plain: true }) as GscAccountRecord);
};

export const upsertAccountForUser = async (params: {
  userId: string;
  googleSub: string;
  email: string;
  picture?: string;
  refreshToken: string;
  scopes?: string;
}) => {
  const { userId, googleSub, email, picture = '', refreshToken, scopes = '' } = params;
  const encrypted = encryptToken(refreshToken);
  const [record, created] = await GscAccount.findOrCreate({
    where: { userId, google_sub: googleSub },
    defaults: {
      userId,
      google_sub: googleSub,
      email,
      refresh_token: encrypted,
      picture,
      connected_at: new Date().toISOString(),
      scopes,
    },
  });

  if (!created) {
    await record.update({
      email,
      refresh_token: encrypted,
      picture,
      connected_at: new Date().toISOString(),
      scopes,
    });
  }

  return record.get({ plain: true }) as GscAccountRecord;
};

export const deleteAccountForUser = async (userId: string, accountId: number) => {
  return GscAccount.destroy({ where: { ID: accountId, userId } });
};

export const buildOAuthClientFromAccount = (account: GscAccountRecord) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.AUTH0_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const oauth2 = new auth.OAuth2(clientId, clientSecret, `${baseUrl}/api/gsc/callback`);
  oauth2.setCredentials({ refresh_token: decryptToken(account.refresh_token) });
  return oauth2;
};

export const refreshAccountProfileFromGoogle = async (account: GscAccountRecord) => {
  if (account.picture && account.email && account.google_sub) {
    return account;
  }

  try {
    const oauthClient = buildOAuthClientFromAccount(account);
    const response = await oauthClient.request<{
      email?: string;
      picture?: string;
      sub?: string;
    }>({
      url: 'https://www.googleapis.com/oauth2/v3/userinfo',
      method: 'GET',
    });
    const profile = response.data || {};
    const nextEmail = profile.email || account.email;
    const nextPicture = profile.picture || account.picture;
    const nextGoogleSub = profile.sub || account.google_sub;

    if (nextEmail !== account.email || nextPicture !== account.picture || nextGoogleSub !== account.google_sub) {
      await GscAccount.update(
        {
          email: nextEmail,
          picture: nextPicture || '',
          google_sub: nextGoogleSub,
        },
        { where: { ID: account.ID, userId: account.userId } },
      );
    }

    return {
      ...account,
      email: nextEmail,
      picture: nextPicture || '',
      google_sub: nextGoogleSub,
    };
  } catch {
    return account;
  }
};
