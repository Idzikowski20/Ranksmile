import type { DatasetLocale, OrganicDataset } from './types';

export type OrganicProviderContext = {
  domain: string;
  country: string;
  languageCode: string;
  locationCode: number;
};

export type OrganicProvider = {
  id: 'dataforseo';
  isConfigured: () => boolean;
  fetchDataset: (ctx: OrganicProviderContext) => Promise<OrganicDataset>;
};

export function localeFromCtx(ctx: OrganicProviderContext): DatasetLocale {
  return {
    country: ctx.country,
    language: ctx.languageCode,
    locationCode: ctx.locationCode,
  };
}
