import { useQuery } from 'react-query';

export type AuthSessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
};

export type AuthSessionPayload = {
  user: AuthSessionUser;
};

export type AuthSessionResult = {
  data: AuthSessionPayload | null;
  isPending: boolean;
  error: unknown;
};

const SESSION_KEY = 'authSession';

type JsonRecord = Record<string, unknown>;

function readString(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function parseUser(raw: unknown): AuthSessionUser | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as JsonRecord;
  const id = readString(record, 'id');
  const email = readString(record, 'email');
  if (!id && !email) return null;
  return {
    id: id ?? '',
    email,
    name: readString(record, 'name'),
    image: readString(record, 'image'),
  };
}

export async function fetchAuthSession(): Promise<AuthSessionPayload | null> {
  const res = await fetch('/api/auth/get-session', { credentials: 'include' });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) return null;

  const text = await res.text();
  if (!text) return null;

  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return null;
  }

  if (typeof data !== 'object' || data === null) return null;
  const record = data as JsonRecord;

  const user =
    parseUser(record.user)
    ?? parseUser(typeof record.session === 'object' && record.session !== null
      ? (record.session as JsonRecord).user
      : null);

  return user ? { user } : null;
}

/** Session hook for authClient.useSession(). */
export function useAuthSession(): AuthSessionResult {
  const query = useQuery(SESSION_KEY, fetchAuthSession, {
    staleTime: 60_000,
    cacheTime: 300_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  return {
    data: query.data ?? null,
    isPending: query.isLoading,
    error: query.error ?? null,
  };
}
