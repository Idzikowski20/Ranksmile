/** Shared Koala UI transactional email shell — Light tokens, email-safe inline hex. */

import { PRODUCTION_APP_URL, isLocalServiceUrl } from '../serviceUrls';

/** DM Sans + system fallbacks (web font loaded in wrapEmail for clients that allow it). */
export const EMAIL_FONT = "'DM Sans',Helvetica,Arial,sans-serif";

/** Koala Light — greyNeutral / darkOrange (see DESIGN.md + components/koala/tokens). */
export const EMAIL_BG_PAGE = '#f5f5f5';
export const EMAIL_BG_CONTENT = '#ffffff';
export const EMAIL_INK = '#1a1a1a';
export const EMAIL_BODY = '#575757';
export const EMAIL_MUTED = '#767676';
export const EMAIL_BORDER = '#e5e5e5';
export const EMAIL_CTA_BG = '#f84416';
export const EMAIL_CTA_FG = '#ffffff';
export const EMAIL_LINK = '#e92b0d';
export const EMAIL_RADIUS_BTN = '12px';
export const EMAIL_RADIUS_CARD = '16px';
export const EMAIL_SUPPORT = 'kontakt@ranksmile.pl';

const EMAIL_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap';

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

/** One content block (tr/td). First block: no top padding; later: padding-top 32px. */
export function emailRow(innerHtml: string, opts?: { first?: boolean }): string {
  const pad = opts?.first ? 'padding:0;word-break:break-word' : 'padding:0;padding-top:32px;word-break:break-word';
  return `<tr>
  <td align="left" style="font-size:0px;${pad}">
    ${innerHtml}
  </td>
</tr>`;
}

export function emailHeadline(text: string): string {
  return `<div style="font-family:${EMAIL_FONT};font-size:28px;font-weight:700;letter-spacing:-0.5px;line-height:36px;text-align:left;color:${EMAIL_INK}">${text}</div>`;
}

export function emailBody(html: string, opts?: { bold?: boolean }): string {
  const weight = opts?.bold ? 700 : 400;
  const color = opts?.bold ? EMAIL_INK : EMAIL_BODY;
  return `<div style="font-family:${EMAIL_FONT};font-size:16px;font-weight:${weight};line-height:26px;text-align:left;color:${color}">${html}</div>`;
}

/** Brand primary button — Koala radius 12px, weight 500. */
export function emailCta(label: string, href: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;line-height:100%">
  <tbody>
    <tr>
      <td align="center" bgcolor="${EMAIL_CTA_BG}" role="presentation" valign="middle" style="border:none;border-radius:${EMAIL_RADIUS_BTN};background:${EMAIL_CTA_BG}">
        <a href="${safeHref}" style="display:inline-block;background:${EMAIL_CTA_BG};color:${EMAIL_CTA_FG};font-family:${EMAIL_FONT};font-size:14px;font-weight:500;line-height:20px;margin:0;text-decoration:none;text-transform:none;padding:10px 16px;border-radius:${EMAIL_RADIUS_BTN}" target="_blank">${safeLabel}</a>
      </td>
    </tr>
  </tbody>
</table>`;
}

export function emailLink(href: string, label?: string): string {
  const safeHref = escapeHtml(href);
  const text = escapeHtml(label ?? href);
  return `<a href="${safeHref}" style="color:${EMAIL_LINK}" target="_blank">${text}</a>`;
}

export function emailSupportLine(): string {
  return emailBody(
    `If you need assistance, contact us at <a href="mailto:${EMAIL_SUPPORT}" style="color:${EMAIL_LINK}" target="_blank">${EMAIL_SUPPORT}</a>.`,
  );
}

/**
 * Public origin for email-hosted assets (/public/email/).
 * Email clients cannot fetch localhost — never emit a local origin here.
 */
export function emailPublicOrigin(): string {
  const configured = (
    process.env.NEXT_PUBLIC_APP_URL
    || process.env.APP_BASE_URL
    || PRODUCTION_APP_URL
  ).trim().replace(/\/$/, '');
  return isLocalServiceUrl(configured) ? PRODUCTION_APP_URL : configured;
}

/** Absolute URL for a file under /public/email/. */
export function emailAssetUrl(filename: string): string {
  return `${emailPublicOrigin()}/email/${filename.replace(/^\/+/, '')}`;
}

/** Public URL for Ranksmile email logo (served from /public/email/). */
export function defaultEmailLogoUrl(): string {
  return emailAssetUrl('ranksmile-logo.png');
}

export function emailLogoRow(logoUrl?: string): string {
  const src = escapeHtml(logoUrl || defaultEmailLogoUrl());
  return emailRow(
    `<img src="${src}" alt="Ranksmile" width="140" height="auto" style="display:block;width:140px;max-width:140px;height:auto;border:0;outline:none;text-decoration:none;" />`,
    { first: true },
  );
}

export type WrapEmailOpts = {
  /** Override logo src. Pass `false` to omit logo (rare). */
  logoUrl?: string | false;
};

/** Full HTML — Koala page bg, white content card, max-width 720, logo on top. */
export function wrapEmail(rowsHtml: string, opts?: WrapEmailOpts): string {
  const logo = opts?.logoUrl === false ? '' : `${emailLogoRow(typeof opts?.logoUrl === 'string' ? opts.logoUrl : undefined)}\n`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${EMAIL_FONT_HREF}" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_BG_PAGE};">
  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background-color:${EMAIL_BG_PAGE};">
    <tbody>
      <tr>
        <td style="direction:ltr;font-size:0px;padding:32px 16px;text-align:center">
          <div style="margin:0 auto;max-width:720px">
            <table border="0" cellpadding="0" cellspacing="0" role="presentation" align="center" width="100%" style="width:100%;background-color:${EMAIL_BG_CONTENT};border:1px solid ${EMAIL_BORDER};border-radius:${EMAIL_RADIUS_CARD}">
              <tbody>
                <tr>
                  <td style="direction:ltr;font-size:0px;padding:32px;text-align:left">
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                      <tbody>
                        ${logo}${rowsHtml}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}
