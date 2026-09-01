/** Shared CREATE IF NOT EXISTS noise filter for ensure* table helpers. */
export function ignoreExistingSchema(scope: string, label: string, e: unknown): void {
  const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
  if (!/exist|duplicate|already/i.test(m)) console.warn(`[${scope}] ${label} failed:`, m);
}
