/**
 * Ranksmile legal entity placeholders — replace before launch (choice 3b).
 * Single source for all /legal pages.
 */
export const LEGAL_COMPANY = {
  legalName: '[COMPANY_LEGAL_NAME]',
  registeredAddress: '[COMPANY_REGISTERED_ADDRESS]',
  nip: '[NIP]',
  krs: '[KRS]',
  country: 'Poland',
  website: 'https://ranksmile.pl',
  appUrl: 'https://app.ranksmile.pl',
  supportEmail: 'kontakt@ranksmile.pl',
  privacyEmail: 'privacy@ranksmile.pl',
  legalEmail: 'legal@ranksmile.pl',
  /** Display date on legal heroes / footers */
  lastUpdated: '1 August 2026',
  lastUpdatedIso: '2026-08-01',
} as const;

export type LegalDocId = 'terms' | 'privacy' | 'cookies' | 'dpa';

export type LegalDocMeta = {
  id: LegalDocId;
  href: string;
  title: string;
  summary: string;
  group: 'agreements' | 'policies';
};

export const LEGAL_DOCS: LegalDocMeta[] = [
  {
    id: 'terms',
    href: '/legal/terms',
    title: 'Terms of Service',
    summary: 'Account, billing, acceptable use, and liability for the Ranksmile Service.',
    group: 'agreements',
  },
  {
    id: 'dpa',
    href: '/legal/dpa',
    title: 'Data Processing Addendum',
    summary: 'Processor terms for customer personal data processed on your behalf (B2B / GDPR).',
    group: 'agreements',
  },
  {
    id: 'privacy',
    href: '/legal/privacy',
    title: 'Privacy Policy',
    summary: 'How we collect, use, and protect personal data when you use Ranksmile.',
    group: 'policies',
  },
  {
    id: 'cookies',
    href: '/legal/cookies',
    title: 'Cookie Policy',
    summary: 'Cookies and similar technologies used to run and improve the Service.',
    group: 'policies',
  },
];
