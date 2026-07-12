import { locationCodeFor } from '../dataforseo';
import { AUDIT_COUNTRIES, langForCountry } from '../countryLang';
import type { RankDevices, RankTrackingConfigRow, ScheduleInterval } from '../types/rankTracking';
import { createConfig, listConfigs } from './repository';
import { queryOne } from '../db/query';

export type DefaultConfigInput = {
  countryCode: string;
  locationCode: number;
  languageCode: string;
  locationName: string;
  label: string;
};

export function defaultConfigFromCountry(countryRaw?: string | null): DefaultConfigInput {
  const countryCode = (countryRaw || 'US').toUpperCase();
  const audit = AUDIT_COUNTRIES.find((c) => c.code === countryCode)
    ?? AUDIT_COUNTRIES.find((c) => c.code === 'US')
    ?? AUDIT_COUNTRIES[0];
  return {
    countryCode: audit.code,
    locationCode: locationCodeFor(audit.code),
    languageCode: langForCountry(audit.code),
    locationName: audit.name,
    label: `${audit.name} · Desktop`,
  };
}

export async function getDomainCountryCode(domainId: number): Promise<string> {
  const row = await queryOne<{ country: string | null }>(
    'SELECT country FROM domain WHERE "ID" = ? LIMIT 1',
    [domainId],
  );
  return (row?.country || 'US').toUpperCase();
}

/** Creates a single default tracking config from the domain's country — no user setup required. */
export async function ensureDefaultConfigForDomain(
  domainId: number,
  opts?: { devices?: RankDevices; scheduleInterval?: ScheduleInterval },
): Promise<RankTrackingConfigRow[]> {
  const existing = await listConfigs(domainId);
  if (existing.length) return existing;

  const country = await getDomainCountryCode(domainId);
  const defaults = defaultConfigFromCountry(country);

  await createConfig({
    domainId,
    label: defaults.label,
    locationCode: defaults.locationCode,
    languageCode: defaults.languageCode,
    devices: opts?.devices ?? 'desktop',
    serpDepth: 40,
    scheduleInterval: opts?.scheduleInterval ?? 'weekly',
    locationName: defaults.locationName,
  });

  return listConfigs(domainId);
}
