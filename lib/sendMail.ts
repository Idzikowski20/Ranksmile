import nodeMailer from 'nodemailer';
import { getAppSettings } from '../pages/api/settings';
import { EMAIL_SEND_TIMEOUT_MS } from './notifications/emailTypes';

export type SendMailResult = {
  sent: boolean;
  /** Provider message id when available (Resend id or Nodemailer messageId). */
  providerMsgId?: string | null;
  /** True when neither Resend nor SMTP is configured. */
  smtpNotConfigured?: boolean;
  /** Hint for permanent failures (e.g. 550). */
  permanent?: boolean;
  error?: string;
};

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
/** Verified domain used by confirm-account mail; override with RESEND_FROM. */
const DEFAULT_RESEND_FROM = 'Ranksmile <noreply@ranksmile.pl>';

function resendApiKey(): string {
  return (process.env.RESEND_APIKEY || process.env.RESEND_API_KEY || '').trim();
}

function resendFrom(): string {
  return (process.env.RESEND_FROM || DEFAULT_RESEND_FROM).trim();
}

function isPermanentSmtpError(err: unknown): boolean {
  const msg = String((err as { message?: string; response?: string })?.message
    ?? (err as { response?: string })?.response
    ?? err ?? '');
  return /\b550\b|\b551\b|\b553\b|mailbox (does not|unavailable)|user unknown|invalid recipient/i.test(msg);
}

function isPermanentResendStatus(status: number): boolean {
  return status === 422 || status === 403 || status === 404;
}

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  timeoutMs: number;
  attachments?: Array<{ filename: string; content: string; contentId: string }>;
}): Promise<SendMailResult> {
  const apiKey = resendApiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const payload: Record<string, unknown> = {
      from: resendFrom(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    };
    if (opts.attachments?.length) {
      payload.attachments = opts.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        content_id: a.contentId,
      }));
    }
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const bodyText = await res.text();
    let providerMsgId: string | null = null;
    try {
      const parsed = JSON.parse(bodyText) as { id?: string };
      if (parsed.id) providerMsgId = String(parsed.id);
    } catch {
      /* ignore non-JSON */
    }
    if (!res.ok) {
      console.error('[sendMail] Resend error', res.status, bodyText.slice(0, 300));
      return {
        sent: false,
        permanent: isPermanentResendStatus(res.status),
        error: `Resend ${res.status}: ${bodyText.slice(0, 200)}`,
        providerMsgId,
      };
    }
    return { sent: true, providerMsgId };
  } catch (err) {
    console.error('[sendMail] Resend request failed:', err);
    return {
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaSmtp(opts: {
  to: string;
  subject: string;
  html: string;
  timeoutMs: number;
}): Promise<SendMailResult> {
  const settings = await getAppSettings();
  const {
    smtp_server = '',
    smtp_port = '',
    smtp_username = '',
    smtp_password = '',
    notification_email_from = '',
    notification_email_from_name = 'Ranksmile',
  } = settings;

  if (!smtp_server || !smtp_port || !notification_email_from) {
    console.warn('[sendMail] SMTP not fully configured (host/port/from missing). Skipping send.');
    return { sent: false, smtpNotConfigured: true };
  }

  const port = parseInt(smtp_port, 10);
  const mailerSettings: {
    host: string;
    port: number;
    secure?: boolean;
    auth?: { user?: string; pass?: string };
  } = {
    host: smtp_server,
    port,
    secure: port === 465,
  };
  if (smtp_username || smtp_password) {
    mailerSettings.auth = {};
    if (smtp_username) mailerSettings.auth.user = smtp_username;
    if (smtp_password) mailerSettings.auth.pass = smtp_password;
  }

  const from = `${notification_email_from_name} <${notification_email_from}>`;

  try {
    const transporter = nodeMailer.createTransport(mailerSettings);
    const sendPromise = transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    const info = await Promise.race([
      sendPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`sendMail timeout after ${opts.timeoutMs}ms`)), opts.timeoutMs);
      }),
    ]);
    const providerMsgId = info && typeof info === 'object' && 'messageId' in info
      ? String((info as { messageId?: string }).messageId ?? '')
      : null;
    return { sent: true, providerMsgId: providerMsgId || null };
  } catch (err) {
    console.error('[sendMail] Failed to send email:', err);
    return {
      sent: false,
      permanent: isPermanentSmtpError(err),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Prefer Resend when RESEND_API_KEY / RESEND_APIKEY is set (verified domain).
 * Otherwise fall back to app_settings SMTP.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  timeoutMs?: number;
  /** Resend CID inline images (base64 content + contentId). */
  attachments?: Array<{ filename: string; content: string; contentId: string }>;
}): Promise<SendMailResult> {
  const timeoutMs = opts.timeoutMs ?? EMAIL_SEND_TIMEOUT_MS;
  if (resendApiKey()) {
    return sendViaResend({ ...opts, timeoutMs });
  }
  return sendViaSmtp({ ...opts, timeoutMs });
}
