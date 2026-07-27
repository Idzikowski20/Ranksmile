/** Shared Surfer-style transactional email shell: white bg, no cards/shadows, 32px rhythm. */

export const EMAIL_FONT = 'Inter,Helvetica,Arial,sans-serif';
export const EMAIL_INK = '#000000';
export const EMAIL_BODY = '#222a3a';
export const EMAIL_CTA_BG = '#222a3a';
export const EMAIL_SUPPORT = 'kontakt@ranksmile.pl';

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
  return `<div style="font-family:${EMAIL_FONT};font-size:30px;font-weight:600;letter-spacing:-1px;line-height:38px;text-align:left;color:${EMAIL_INK}">${text}</div>`;
}

export function emailBody(html: string, opts?: { bold?: boolean }): string {
  const weight = opts?.bold ? 600 : 400;
  return `<div style="font-family:${EMAIL_FONT};font-size:16px;font-weight:${weight};line-height:26px;text-align:left;color:${EMAIL_BODY}">${html}</div>`;
}

export function emailCta(label: string, href: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;line-height:100%">
  <tbody>
    <tr>
      <td align="center" bgcolor="${EMAIL_CTA_BG}" role="presentation" valign="middle" style="border:none;border-radius:8px;background:${EMAIL_CTA_BG}">
        <a href="${safeHref}" style="display:inline-block;background:${EMAIL_CTA_BG};color:#ffffff;font-family:${EMAIL_FONT};font-size:16px;font-weight:600;line-height:24px;margin:0;text-decoration:none;text-transform:none;padding:8px 24px;border-radius:8px" target="_blank">${safeLabel}</a>
      </td>
    </tr>
  </tbody>
</table>`;
}

export function emailLink(href: string, label?: string): string {
  const safeHref = escapeHtml(href);
  const text = escapeHtml(label ?? href);
  return `<a href="${safeHref}" style="color:${EMAIL_BODY}" target="_blank">${text}</a>`;
}

export function emailSupportLine(): string {
  return emailBody(
    `If you need assistance, contact us at <a href="mailto:${EMAIL_SUPPORT}" style="color:${EMAIL_BODY}" target="_blank">${EMAIL_SUPPORT}</a>.`,
  );
}

/** Public URL for Ranksmile email logo (served from /public/email/). */
export function defaultEmailLogoUrl(): string {
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL
    || process.env.APP_BASE_URL
    || 'https://app.ranksmile.pl'
  ).trim().replace(/\/$/, '');
  return `${origin}/email/ranksmile-logo.png`;
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

/** Full HTML document — white background, max-width 720, logo on top, no boxes/shadows. */
export function wrapEmail(rowsHtml: string, opts?: WrapEmailOpts): string {
  const logo = opts?.logoUrl === false ? '' : `${emailLogoRow(typeof opts?.logoUrl === 'string' ? opts.logoUrl : undefined)}\n`;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background-color:#ffffff;">
    <tbody>
      <tr>
        <td style="direction:ltr;font-size:0px;padding:16px 32px;padding-top:32px;text-align:center">
          <div style="margin:0px auto;max-width:720px">
            <table border="0" cellpadding="0" cellspacing="0" role="presentation" align="center" style="width:100%">
              <tbody>
                <tr>
                  <td style="direction:ltr;font-size:0px;padding:0;text-align:left">
                    <div style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%">
                      <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                        <tbody>
                          <tr>
                            <td style="vertical-align:top;padding:0">
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
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}
