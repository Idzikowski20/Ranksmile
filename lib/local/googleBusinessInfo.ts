import axios from 'axios';
import { isDataForSeoConfigured, locationCodeFor } from '../dataforseo';
import { getSerperPlacesApiKeys } from './serperPlaces';
import type { BusinessDetails, DayHours, GbpProfile } from './types';
import { DEFAULT_HOURS } from './types';
import { gbpToBusinessDetails } from './mockPlaces';

type DfsTimePoint = { hour?: number; minute?: number };
type DfsDaySlot = { open?: DfsTimePoint; close?: DfsTimePoint };
type DfsTimetable = Partial<Record<string, DfsDaySlot[] | null>>;

type DfsBusinessInfoItem = {
  title?: string;
  description?: string;
  category?: string;
  additional_categories?: string[];
  address?: string;
  phone?: string;
  url?: string;
  domain?: string;
  logo?: string;
  main_image?: string;
  total_photos?: number;
  work_time?: {
    work_hours?: {
      timetable?: DfsTimetable;
    };
  };
};

type SerperMapsPlace = {
  title?: string;
  address?: string;
  phoneNumber?: string;
  website?: string;
  type?: string;
  types?: string[];
  thumbnailUrl?: string;
  openingHours?: Record<string, string>;
};

const DAY_KEYS: Array<{ key: string; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const PL_DAY_TO_EN: Record<string, string> = {
  poniedziałek: 'Monday',
  wtorek: 'Tuesday',
  środa: 'Wednesday',
  czwartek: 'Thursday',
  piątek: 'Friday',
  sobota: 'Saturday',
  niedziela: 'Sunday',
};

function formatTime(point: DfsTimePoint | undefined): string {
  const hour = typeof point?.hour === 'number' ? point.hour : 0;
  const minute = typeof point?.minute === 'number' ? point.minute : 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function upgradeGoogleImageUrl(url: string, size = 1200): string {
  if (!url) return url;
  if (/=s\d+-/.test(url)) {
    return url.replace(/=s\d+-/, `=s${size}-`);
  }
  if (/\/s\d+-/.test(url)) {
    return url.replace(/\/s\d+-/, `/s${size}-`);
  }
  if (/=w\d+-h\d+/.test(url)) {
    return url.replace(/=w\d+-h\d+[^&]*/, `=w${size}-h${Math.round(size * 0.75)}-k-no`);
  }
  return url;
}

function uniqueUrls(urls: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function hoursFromDfsTimetable(timetable: DfsTimetable | undefined): DayHours[] {
  if (!timetable) return DEFAULT_HOURS.map((h) => ({ ...h }));

  return DAY_KEYS.map(({ key, label }) => {
    const slots = timetable[key];
    if (!slots || slots.length === 0) {
      return { day: label, status: 'closed' as const };
    }
    const first = slots[0];
    return {
      day: label,
      status: 'open' as const,
      openTime: formatTime(first.open),
      closeTime: formatTime(first.close),
    };
  });
}

function hoursFromSerperOpeningHours(openingHours: Record<string, string> | undefined): DayHours[] {
  if (!openingHours) return DEFAULT_HOURS.map((h) => ({ ...h }));

  return DAY_KEYS.map(({ label }) => {
    const plKey = Object.keys(PL_DAY_TO_EN).find((k) => PL_DAY_TO_EN[k] === label);
    const raw = (plKey && openingHours[plKey]) || openingHours[label.toLowerCase()] || '';
    const normalized = raw.toLowerCase();
    if (!raw || normalized.includes('zamknię') || normalized.includes('closed')) {
      return { day: label, status: 'closed' as const };
    }
    const match = raw.match(/(\d{1,2}:\d{2})\s*[–\-—]\s*(\d{1,2}:\d{2})/);
    if (!match) return { day: label, status: 'open' as const, openTime: '09:00', closeTime: '17:00' };
    const toClock = (value: string) => {
      const [h, m] = value.split(':');
      return `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}`;
    };
    return {
      day: label,
      status: 'open' as const,
      openTime: toClock(match[1]),
      closeTime: toClock(match[2]),
    };
  });
}

function isGoogleListingPhoto(url: string): boolean {
  if (!url.includes('googleusercontent.com') && !url.includes('ggpht.com')) return false;
  // Skip reviewer avatars (`/a/`) — keep Maps listing photos.
  if (url.includes('googleusercontent.com/a/')) return false;
  return true;
}

async function fetchSerperMapsPlace(query: string, country = 'PL'): Promise<SerperMapsPlace | null> {
  const keys = getSerperPlacesApiKeys();
  if (keys.length === 0) return null;

  const gl = /^[A-Z]{2}$/i.test(country) ? country.toLowerCase() : 'pl';
  let lastError: Error | null = null;

  for (const apiKey of keys) {
    try {
      const response = await fetch('https://google.serper.dev/maps', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, gl, hl: gl === 'pl' ? 'pl' : 'en' }),
      });
      if (!response.ok) {
        throw new Error(`Serper maps ${response.status}`);
      }
      const data = (await response.json()) as { places?: SerperMapsPlace[] };
      const place = data.places?.[0];
      if (place) return place;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (lastError) throw lastError;
  return null;
}

async function fetchSerperListingPhotos(query: string, websiteHost?: string): Promise<string[]> {
  const keys = getSerperPlacesApiKeys();
  if (keys.length === 0) return [];

  const apiKey = keys[0];
  const response = await fetch('https://google.serper.dev/images', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, gl: 'pl', hl: 'pl', num: 20 }),
  });
  if (!response.ok) return [];

  const data = (await response.json()) as {
    images?: Array<{ imageUrl?: string; domain?: string }>;
  };

  const host = websiteHost?.replace(/^www\./, '').toLowerCase();
  const urls: string[] = [];

  for (const image of data.images ?? []) {
    const url = image.imageUrl?.trim();
    if (!url) continue;
    if (isGoogleListingPhoto(url)) {
      urls.push(upgradeGoogleImageUrl(url));
      continue;
    }
    // Same-domain website assets are often the photos also uploaded to GBP.
    if (host && (image.domain || '').replace(/^www\./, '').toLowerCase() === host) {
      urls.push(url);
    }
  }

  return uniqueUrls(urls).slice(0, 12);
}

async function fetchDataForSeoBusinessInfo(
  keyword: string,
  country = 'PL',
): Promise<DfsBusinessInfoItem | null> {
  if (!isDataForSeoConfigured()) return null;

  const login = process.env.DATAFORSEO_LOGIN || '';
  const password = process.env.DATAFORSEO_PASSWORD || '';
  const auth = `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;

  const res = await axios.post(
    'https://api.dataforseo.com/v3/business_data/google/my_business_info/live',
    [{
      keyword,
      location_code: locationCodeFor(country),
      language_code: country.toUpperCase() === 'PL' ? 'pl' : 'en',
    }],
    {
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      timeout: 60000,
    },
  );

  const payload = res.data as {
    status_code?: number;
    status_message?: string;
    tasks?: Array<{
      status_code?: number;
      status_message?: string;
      result?: Array<{ items?: DfsBusinessInfoItem[] }>;
    }>;
  };

  if (payload.status_code !== 20000) {
    throw new Error(`DataForSEO API ${payload.status_code}: ${payload.status_message}`);
  }
  const task = payload.tasks?.[0];
  if (task?.status_code !== 20000) {
    throw new Error(`DataForSEO task ${task?.status_code}: ${task?.status_message}`);
  }

  return task.result?.[0]?.items?.[0] ?? null;
}

function detailsFromDfsItem(
  item: DfsBusinessInfoItem,
  fallback: BusinessDetails,
  extraPhotos: string[],
): BusinessDetails {
  const googleCategories = uniqueUrls([
    item.category,
    ...(item.additional_categories ?? []),
  ]);
  const logoUrl = item.logo ? upgradeGoogleImageUrl(item.logo, 512) : fallback.logoUrl;
  const coverUrl = item.main_image
    ? upgradeGoogleImageUrl(item.main_image)
    : fallback.coverUrl;
  const googlePhotos = extraPhotos.filter(isGoogleListingPhoto);
  const sitePhotos = extraPhotos.filter((url) => !isGoogleListingPhoto(url));
  const photoUrls = uniqueUrls([
    coverUrl,
    ...googlePhotos,
    ...(googlePhotos.length < 3 ? sitePhotos : []),
  ]).filter((url) => !url.startsWith('/images/'));

  return {
    ...fallback,
    name: item.title?.trim() || fallback.name,
    address: item.address?.trim() || fallback.address,
    phone: item.phone?.trim() || fallback.phone,
    website: item.url?.trim() || fallback.website,
    description: item.description?.trim() || fallback.description,
    googleCategories: googleCategories.length > 0 ? googleCategories : fallback.googleCategories,
    directoryCategories: googleCategories.length > 0 ? googleCategories : fallback.directoryCategories,
    logoUrl,
    coverUrl,
    photoUrls,
    hours: hoursFromDfsTimetable(item.work_time?.work_hours?.timetable),
  };
}

function detailsFromSerperMaps(
  place: SerperMapsPlace,
  fallback: BusinessDetails,
  extraPhotos: string[],
): BusinessDetails {
  const googleCategories = uniqueUrls([place.type, ...(place.types ?? [])]);
  const coverUrl = place.thumbnailUrl
    ? upgradeGoogleImageUrl(place.thumbnailUrl)
    : fallback.coverUrl;
  const googlePhotos = extraPhotos.filter(isGoogleListingPhoto);
  const sitePhotos = extraPhotos.filter((url) => !isGoogleListingPhoto(url));
  const photoUrls = uniqueUrls([
    coverUrl,
    ...googlePhotos,
    ...(googlePhotos.length < 3 ? sitePhotos : []),
  ]).filter((url) => !url.startsWith('/images/'));

  return {
    ...fallback,
    name: place.title?.trim() || fallback.name,
    address: place.address?.trim() || fallback.address,
    phone: place.phoneNumber?.trim() || fallback.phone,
    website: place.website?.trim() || fallback.website,
    googleCategories: googleCategories.length > 0 ? googleCategories : fallback.googleCategories,
    directoryCategories: googleCategories.length > 0 ? googleCategories : fallback.directoryCategories,
    coverUrl,
    logoUrl: fallback.logoUrl,
    photoUrls,
    hours: hoursFromSerperOpeningHours(place.openingHours),
  };
}

export type GoogleBusinessImportResult = {
  details: BusinessDetails;
  source: 'dataforseo' | 'serper' | 'mock';
};

export async function importGoogleBusinessDetails(
  profile: Pick<GbpProfile, 'name' | 'address' | 'phone' | 'website'>,
  country = 'PL',
): Promise<GoogleBusinessImportResult> {
  const query = [profile.name, profile.address].filter(Boolean).join(' ');
  const fallback = gbpToBusinessDetails({
    id: 'import',
    accountId: '',
    locationId: 'import',
    name: profile.name,
    address: profile.address,
    phone: profile.phone,
    website: profile.website,
    hasEditAccess: true,
  });

  try {
    const dfsItem = await fetchDataForSeoBusinessInfo(query, country);
    if (dfsItem) {
      const host = dfsItem.domain || (dfsItem.url ? new URL(dfsItem.url).hostname : undefined);
      const extraPhotos = await fetchSerperListingPhotos(query, host).catch(() => []);
      return {
        details: detailsFromDfsItem(dfsItem, fallback, extraPhotos),
        source: 'dataforseo',
      };
    }
  } catch (err) {
    console.error('[googleBusinessInfo] DataForSEO failed:', err);
  }

  try {
    const mapsPlace = await fetchSerperMapsPlace(query, country);
    if (mapsPlace) {
      const host = mapsPlace.website ? new URL(mapsPlace.website).hostname : undefined;
      const extraPhotos = await fetchSerperListingPhotos(query, host).catch(() => []);
      return {
        details: detailsFromSerperMaps(mapsPlace, fallback, extraPhotos),
        source: 'serper',
      };
    }
  } catch (err) {
    console.error('[googleBusinessInfo] Serper maps failed:', err);
  }

  return {
    details: {
      ...fallback,
      photoUrls: fallback.photoUrls.filter((url) => !url.startsWith('/images/')),
      logoUrl: fallback.logoUrl?.startsWith('/images/') ? undefined : fallback.logoUrl,
      coverUrl: fallback.coverUrl?.startsWith('/images/') ? undefined : fallback.coverUrl,
    },
    source: 'mock',
  };
}
