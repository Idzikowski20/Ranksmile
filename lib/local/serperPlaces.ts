import type { BusinessPlace } from './types';
import { normalizeText } from './mockPlaces';
import { langForCountry } from '../countryLang';

type SerperPlaceItem = {
  title?: string;
  address?: string;
  phone?: string;
  placeId?: string;
  cid?: string;
  position?: number;
};

type SerperPlacesResponse = {
  places?: SerperPlaceItem[];
};

export function getSerperPlacesApiKeys(): string[] {
  const keys: string[] = [];
  const push = (value: string | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed || keys.includes(trimmed)) return;
    keys.push(trimmed);
  };

  // Places endpoint may use a different Serper key than the SERP scraper.
  push(process.env.SERPER_API_KEY);
  push(process.env.SCRAPER_API_KEY);

  return keys;
}

function serperGlHl(country: string): { gl: string; hl: string } {
  const code = (country || 'PL').toUpperCase();
  const hl = langForCountry(code);
  // Serper `gl` is the lowercase ISO country; default PL for Local product.
  const gl = /^[A-Z]{2}$/.test(code) ? code.toLowerCase() : 'pl';
  return { gl, hl: hl || 'pl' };
}

function serperPlaceToBusinessPlace(item: SerperPlaceItem, index: number): BusinessPlace | null {
  const name = item.title?.trim();
  if (!name) return null;

  const address = item.address?.trim() || '';
  const stableId = item.placeId || item.cid;
  const id = stableId
    ? `serper-${stableId}`
    : `serper-${index}-${normalizeText(name).replace(/\s+/g, '-').slice(0, 40)}`;

  return {
    id,
    name,
    address,
    phone: item.phone?.trim() || undefined,
  };
}

async function fetchSerperPlacesWithKey(
  query: string,
  country: string,
  apiKey: string,
): Promise<BusinessPlace[]> {
  const { gl, hl } = serperGlHl(country);

  const response = await fetch('https://google.serper.dev/places', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, gl, hl }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Serper places ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as SerperPlacesResponse;
  const items = data.places ?? [];

  return items
    .map((item, index) => serperPlaceToBusinessPlace(item, index))
    .filter((place): place is BusinessPlace => place !== null);
}

export async function fetchSerperPlaces(
  query: string,
  country = 'PL',
): Promise<BusinessPlace[]> {
  const apiKeys = getSerperPlacesApiKeys();
  if (apiKeys.length === 0) return [];

  let lastError: Error | null = null;

  for (const apiKey of apiKeys) {
    try {
      const places = await fetchSerperPlacesWithKey(query, country, apiKey);
      if (places.length > 0) return places;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (lastError) throw lastError;
  return [];
}
