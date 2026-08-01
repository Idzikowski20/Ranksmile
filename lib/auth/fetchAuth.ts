/**
 * Neon / Better Auth REST calls (fetch-based; no auth SDK client).
 * Proxied via pages/api/auth/[...auth0].ts → NEON_AUTH_BASE_URL.
 */

const AUTH_BASE = '/api/auth';

export type AuthFetchError = {
  message: string;
  status: number;
};

export type AuthFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthFetchError };

type JsonRecord = Record<string, unknown>;

function extractMessage(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const record = data as JsonRecord;
  if (typeof record.message === 'string') return record.message;
  if (typeof record.error === 'string') return record.error;
  if (typeof record.error === 'object' && record.error !== null) {
    const nested = record.error as JsonRecord;
    if (typeof nested.message === 'string') return nested.message;
  }
  return undefined;
}

async function authPost<T>(path: string, body: JsonRecord): Promise<AuthFetchResult<T>> {
  const res = await fetch(`${AUTH_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { message: text };
    }
  }

  if (res.ok) {
    return { ok: true, data: data as T };
  }

  return {
    ok: false,
    error: {
      message: extractMessage(data) ?? 'Request failed',
      status: res.status,
    },
  };
}

export type SignInEmailResponse = {
  twoFactorRedirect?: boolean;
  url?: string;
};

export type SignInSocialResponse = {
  url?: string;
  redirect?: boolean;
};

export function signInEmail(params: {
  email: string;
  password: string;
  callbackURL?: string;
  rememberMe?: boolean;
}): Promise<AuthFetchResult<SignInEmailResponse>> {
  return authPost<SignInEmailResponse>('sign-in/email', params);
}

export function signInSocial(params: {
  provider: 'google' | 'github' | 'apple';
  callbackURL?: string;
  errorCallbackURL?: string;
}): Promise<AuthFetchResult<SignInSocialResponse>> {
  return authPost<SignInSocialResponse>('sign-in/social', params);
}

export function signUpEmail(params: {
  email: string;
  password: string;
  name: string;
  callbackURL?: string;
}): Promise<AuthFetchResult<unknown>> {
  return authPost('sign-up/email', params);
}

export function signOut(): Promise<AuthFetchResult<unknown>> {
  return authPost('sign-out', {});
}

export function requestPasswordReset(params: {
  email: string;
  redirectTo: string;
}): Promise<AuthFetchResult<unknown>> {
  return authPost('forget-password', params);
}

export function resetPassword(params: {
  newPassword: string;
  token: string;
}): Promise<AuthFetchResult<unknown>> {
  return authPost('reset-password', params);
}

export function changePassword(params: {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
}): Promise<AuthFetchResult<unknown>> {
  return authPost('change-password', params);
}

export function verifyTwoFactor(params: {
  code: string;
}): Promise<AuthFetchResult<unknown>> {
  return authPost('two-factor/verify', params);
}

export function verifyEmailOtp(params: {
  email: string;
  otp: string;
}): Promise<AuthFetchResult<unknown>> {
  return authPost('email-otp/verify-email', params);
}
