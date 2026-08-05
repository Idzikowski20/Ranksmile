import type { PaymentMethodViewModel } from './paymentMethodViewModel';

/**
 * Pick a replacement PM after removing `removedId`.
 * Ranking: preferred → default → most_recent_success → created.
 */
export function chooseReplacement(
  paymentMethods: PaymentMethodViewModel[],
  removedId: string,
  previousDefaultId: string | null,
): PaymentMethodViewModel | null {
  const candidates = paymentMethods.filter((pm) => pm.id !== removedId && !pm.roles.includes('expired'));
  if (candidates.length === 0) return null;

  const preferred = candidates.find((pm) => pm.rankingHint === 'preferred');
  if (preferred) return preferred;

  const defaultCandidate = candidates.find((pm) => pm.roles.includes('default'));
  if (defaultCandidate) return defaultCandidate;

  if (previousDefaultId && previousDefaultId !== removedId) {
    const prev = candidates.find((pm) => pm.id === previousDefaultId);
    if (prev) return prev;
  }

  const withSuccess = candidates
    .filter((pm) => pm.lastSuccessAt != null)
    .sort((a, b) => (b.lastSuccessAt ?? 0) - (a.lastSuccessAt ?? 0));
  if (withSuccess[0]) return withSuccess[0];

  return [...candidates].sort((a, b) => b.created - a.created)[0] ?? null;
}
