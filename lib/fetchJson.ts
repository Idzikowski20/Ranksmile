/** Fetch JSON, returning a typed fallback on any non-2xx response. */
export default async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) return fallback;
  return res.json();
}
