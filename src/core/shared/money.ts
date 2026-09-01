export interface UpcomingPaymentDetails {
  planName: string;
  planAmountCents: number;
  taxAmountCents: number;
  taxLabel: string | null;
  totalAmountCents: number;
  currency: string;
  renewalDate: string | null;
  renewalDateLabel: string | null;
}

export function formatMoney(cents: number, currency: string): string {
  const amount = cents / 100;
  if (currency.toLowerCase() === 'eur') {
    return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount);
}

export function formatUpcomingTotal(upcoming: UpcomingPaymentDetails | null, canceled: boolean): string {
  if (canceled || !upcoming) return '€0.00';
  return formatMoney(upcoming.totalAmountCents, upcoming.currency);
}
