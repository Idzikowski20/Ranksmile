import type { NextApiRequest, NextApiResponse } from 'next';
import { OAuth2Client } from 'google-auth-library';
import { readFile, writeFile } from 'fs/promises';
import Cryptr from 'cryptr';
import getConfig from 'next/config';
import db from '../../database/database';
import verifyUser from '../../utils/verifyUser';
import { getAdwordsCredentials, getAdwordsKeywordIdeas } from '../../utils/adwords';

type adwordsValidateResp = {
   valid: boolean
   error?: string|null,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   // OAuth callback from Google — secured server-side, no session cookie needed.
   if (req.method === 'GET' && req.query.code) {
      return getAdwordsRefreshToken(req, res);
   }
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   // Return the OAuth authorization URL so the frontend can open it without knowing the client_id.
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

/** Build and return the Google OAuth2 authorization URL from env credentials. */
const getAdwordsAuthUrl = async (req: NextApiRequest, res: NextApiResponse) => {
   const client_id = process.env.ADWORDS_CLIENT_ID || '';
   if (!client_id) {
      return res.status(400).json({ error: 'ADWORDS_CLIENT_ID is not set in .env' });
   }
   const redirectURL = buildRedirectUrl(req);
   const authUrl = `https://accounts.google.com/o/oauth2/v2/auth/oauthchooseaccount`
      + `?access_type=offline`
      + `&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fadwords`
      + `&response_type=code`
      + `&client_id=${encodeURIComponent(client_id)}`
      + `&redirect_uri=${encodeURIComponent(redirectURL)}`
      + `&service=lso&o2v=2&theme=glif&flowName=GeneralOAuthFlow`;
   return res.status(200).json({ url: authUrl });
};

/** Exchange the Google OAuth code for a refresh token and save it to settings.json. */
const getAdwordsRefreshToken = async (req: NextApiRequest, res: NextApiResponse<string>) => {
   try {
      const code = req.query.code as string;
      const redirectURL = buildRedirectUrl(req);

      if (code) {
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
               // Save only the refresh token to settings.json (all other creds live in .env)
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
         } catch (error: any) {
            let errorMsg = error?.response?.data?.error || '';
            if (typeof errorMsg === 'string' && errorMsg.includes('redirect_uri_mismatch')) {
               errorMsg += ` Redirected URL: ${redirectURL}`;
            }
            console.log('[Error] Getting Google Ads Refresh Token! Reason: ', errorMsg);
            return res.status(400).send(`Error Saving the Google Ads Refresh Token${errorMsg ? `. Details: ${errorMsg}` : ''}. Please Try Again!`);
         }
      } else {
         return res.status(400).send('No Code Provided By Google. Please Try Again!');
      }
   } catch (error) {
      console.log('[ERROR] Getting Google Ads Refresh Token: ', error);
      return res.status(400).send('Error Getting Google Ads Refresh Token. Please Try Again!');
   }
};

/** Test that all env credentials + stored refresh token are working. */
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

/** Remove the stored Google Ads refresh token (disconnect). */
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

/** Build the OAuth redirect URL using NEXT_PUBLIC_APP_URL / X-Forwarded headers / host. */
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
