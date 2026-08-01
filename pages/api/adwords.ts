import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { readFile, writeFile } from 'fs/promises';
import Cryptr from 'cryptr';
import getConfig from 'next/config';
import db from '../../database/database';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { getAdwordsCredentials, getAdwordsKeywordIdeas } from '../../utils/adwords';
import { withOrgPaymentAccess } from '../../lib/requireOrgPaymentAccess';

type adwordsValidateResp = {
   valid: boolean
   error?: string|null,
}

function parseState(state: string): { userId?: string; nonce?: string } {
   try {
      const parsed = JSON.parse(state) as { userId?: string; nonce?: string };
      return parsed;
   } catch {
      return {};
   }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   // OAuth callback — CSRF via state cookie + session
   if (req.method === 'GET' && req.query.code) {
      return getAdwordsRefreshToken(req, res);
   }
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   if (req.method === 'GET' && req.query.get_url) {
      return getAdwordsAuthUrl(req, res);
   }
   if (req.method === 'POST') {
      return validateAdwordsIntegration(req, res);
   }
   if (req.method === 'DELETE') {
      return disconnectGoogleAds(req, res);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const getAdwordsAuthUrl = async (req: NextApiRequest, res: NextApiResponse) => {
   const userId = await getCurrentUserId(req, res);
   if (!userId) {
      return res.status(401).json({ error: 'Not authorized' });
   }
   const client_id = process.env.ADWORDS_CLIENT_ID || '';
   if (!client_id) {
      return res.status(400).json({ error: 'ADWORDS_CLIENT_ID is not set in .env' });
   }
   const redirectURL = buildRedirectUrl(req);
   const nonce = crypto.randomBytes(16).toString('hex');
   const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
   res.setHeader(
      'Set-Cookie',
      `adwords_oauth_state=${nonce}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
   );
   const state = JSON.stringify({ userId, nonce });
   const authUrl = `https://accounts.google.com/o/oauth2/v2/auth/oauthchooseaccount`
      + `?access_type=offline`
      + `&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fadwords`
      + `&response_type=code`
      + `&client_id=${encodeURIComponent(client_id)}`
      + `&redirect_uri=${encodeURIComponent(redirectURL)}`
      + `&state=${encodeURIComponent(state)}`
      + `&service=lso&o2v=2&theme=glif&flowName=GeneralOAuthFlow`;
   return res.status(200).json({ url: authUrl });
};

const getAdwordsRefreshToken = async (req: NextApiRequest, res: NextApiResponse<string>) => {
   try {
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const stateRaw = typeof req.query.state === 'string' ? req.query.state : '';
      const redirectURL = buildRedirectUrl(req);

      res.setHeader('Set-Cookie', 'adwords_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');

      const { nonce: stateNonce, userId: stateUserId } = parseState(stateRaw);
      if (!stateNonce || req.cookies.adwords_oauth_state !== stateNonce) {
         console.error('[AdWords OAuth] state nonce mismatch (possible CSRF)');
         return res.status(400).send('Invalid OAuth state. Please try connecting again.');
      }

      const sessionUserId = await getCurrentUserId(req, res);
      if (!sessionUserId || !stateUserId || sessionUserId !== stateUserId) {
         return res.status(401).send('Not authenticated. Please sign in and try again.');
      }

      if (!code) {
         return res.status(400).send('No Code Provided By Google. Please Try Again!');
      }

      try {
         const client_id = process.env.ADWORDS_CLIENT_ID || '';
         const client_secret = process.env.ADWORDS_CLIENT_SECRET || '';
         if (!client_id || !client_secret) {
            return res.status(400).send('ADWORDS_CLIENT_ID and ADWORDS_CLIENT_SECRET must be set in .env');
         }
         const oAuth2Client = new OAuth2Client(client_id, client_secret, redirectURL);
         const r = await oAuth2Client.getToken(code);
         if (r?.tokens?.refresh_token) {
            const cryptr = new Cryptr(process.env.SECRET as string);
            const adwords_refresh_token = cryptr.encrypt(r.tokens.refresh_token);
            const settingsRaw = await readFile(`${process.cwd()}/data/settings.json`, { encoding: 'utf-8' }).catch(() => '{}');
            const settings: SettingsType = settingsRaw ? JSON.parse(settingsRaw) : {};
            await writeFile(
               `${process.cwd()}/data/settings.json`,
               JSON.stringify({ ...settings, adwords_refresh_token }),
               { encoding: 'utf-8' },
            );
            return res.status(200).send('Google Ads Integrated Successfully! You can close this window.');
         }
         return res.status(400).send('Error Getting the Google Ads Refresh Token. Please Try Again!');
      } catch (error) {
         const e = error as { response?: { data?: { error?: string } } };
         let errorMsg = e?.response?.data?.error || '';
         if (typeof errorMsg === 'string' && errorMsg.includes('redirect_uri_mismatch')) {
            errorMsg += ` Redirected URL: ${redirectURL}`;
         }
         console.log('[Error] Getting Google Ads Refresh Token! Reason: ', errorMsg);
         return res.status(400).send(`Error Saving the Google Ads Refresh Token${errorMsg ? `. Details: ${errorMsg}` : ''}. Please Try Again!`);
      }
   } catch (error) {
      console.log('[ERROR] Getting Google Ads Refresh Token: ', error);
      return res.status(400).send('Error Getting Google Ads Refresh Token. Please Try Again!');
   }
};

const validateAdwordsIntegration = async (req: NextApiRequest, res: NextApiResponse<adwordsValidateResp>) => {
   const errMsg = 'Error Validating Google Ads Integration. Make sure all ADWORDS_* variables are set in .env and OAuth is connected.';
   try {
      const adwordsCreds = await getAdwordsCredentials();
      const { client_id, client_secret, developer_token, account_id, refresh_token } = adwordsCreds || {};
      if (adwordsCreds && client_id && client_secret && developer_token && account_id && refresh_token) {
         const keywords = await getAdwordsKeywordIdeas(
            adwordsCreds,
            { country: 'US', language: '1000', keywords: ['compress'], seedType: 'custom' },
            true,
         );
         if (keywords && Array.isArray(keywords) && keywords.length > 0) {
            return res.status(200).json({ valid: true });
         }
      }
      return res.status(400).json({ valid: false, error: errMsg });
   } catch (error) {
      console.log('[ERROR] Validating Google Ads Integration: ', error);
      return res.status(400).json({ valid: false, error: errMsg });
   }
};

const disconnectGoogleAds = async (_req: NextApiRequest, res: NextApiResponse) => {
   try {
      const settingsRaw = await readFile(`${process.cwd()}/data/settings.json`, { encoding: 'utf-8' }).catch(() => '{}');
      const settings: SettingsType = settingsRaw ? JSON.parse(settingsRaw) : {};
      delete settings.adwords_refresh_token;
      await writeFile(
         `${process.cwd()}/data/settings.json`,
         JSON.stringify(settings),
         { encoding: 'utf-8' },
      );
      return res.status(200).json({ disconnected: true });
   } catch (error) {
      console.log('[ERROR] Disconnecting Google Ads:', error);
      return res.status(400).json({ error: 'Failed to disconnect Google Ads' });
   }
};

const buildRedirectUrl = (req: NextApiRequest): string => {
   const { serverRuntimeConfig } = getConfig() || {};
   const appURL: string = serverRuntimeConfig?.appURL || '';
   if (appURL) {
      return `${appURL.replace(/\/$/, '')}/api/adwords`;
   }
   const fwdProto = req.headers['x-forwarded-proto'] as string | undefined;
   const fwdHost = req.headers['x-forwarded-host'] as string | undefined;
   const proto = fwdProto || (req.headers.host?.includes('localhost:') ? 'http' : 'https');
   const host = fwdHost || req.headers.host;
   return `${proto}://${host}/api/adwords`;
};

export default withOrgPaymentAccess(handler);
