import type { BootstrapData } from './getBootstrap';

/** Client bootstrap — 401 means signed out; other failures throw. */
export async function fetchBootstrap(): Promise<BootstrapData> {
  const r = await fetch('/api/session/bootstrap');
  if (!r.ok) throw new Error('bootstrap failed');
  return r.json() as Promise<BootstrapData>;
}

/** Guard variant — signed-out is null, not an error. */
export async function fetchBootstrapOrNull(): Promise<BootstrapData | null> {
  const r = await fetch('/api/session/bootstrap');
  if (r.status === 401) return null;
  if (!r.ok) throw new Error('bootstrap failed');
  return r.json() as Promise<BootstrapData>;
}
