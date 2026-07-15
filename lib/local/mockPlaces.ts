import type { BusinessDetails, BusinessPlace, BusinessCategory, GbpProfile } from './types';

export const MOCK_PLACES: BusinessPlace[] = [
  {
    id: 'place-prodetektyw',
    name: 'Agencja Detektywistyczna Pro Detektyw | Biuro Detektywistyczne Warszawa',
    address: 'Mazowiecka 11/49, 00-052 Warszawa, Poland',
    phone: '+48 500 156 015',
  },
  {
    id: 'place-aodc',
    name: 'AODC Sp. z o.o.',
    address: 'Działkowa 37, Warszawa, 02-234, PL',
    phone: '+48 22 846 35 15',
  },
  {
    id: 'place-urbaniak',
    name: 'Urbaniak Home & Gardens',
    address: 'Głębocka 88, Warszawa, 03-287, PL',
    phone: '+48 501 636 014',
  },
  {
    id: 'place-autopark',
    name: 'Auto Park Ostrowiec',
    address: 'Opatowska 126, Ostrowiec Świętokrzyski, 27-400, PL',
    phone: '+48 512 980 279',
  },
  {
    id: 'place-philips',
    name: 'Philips Polska Sp. z o.o.',
    address: 'Al. Jerozolimskie 142B, 02-305 Warszawa, PL',
    phone: '+48 22 612 2000',
  },
  {
    id: 'place-philips-lighting',
    name: 'Philips Lighting Poland',
    address: 'ul. Bema 64, 01-147 Warszawa, PL',
    phone: '+48 22 532 6000',
  },
  {
    id: 'place-ikea',
    name: 'IKEA Warszawa - Janki',
    address: 'Włościańska 59, 05-090 Raszyn, PL',
    phone: '+48 22 211 00 00',
  },
  {
    id: 'place-orlen',
    name: 'ORLEN S.A. - Centrala',
    address: 'Chemików 7, 09-411 Płock, PL',
    phone: '+48 24 256 00 00',
  },
  {
    id: 'place-zabka',
    name: 'Żabka Polska sp. z o.o.',
    address: 'ul. Stanisława Żaryna 2A, 02-593 Warszawa, PL',
    phone: '+48 22 431 00 00',
  },
  {
    id: 'place-allegro',
    name: 'Allegro sp. z o.o.',
    address: 'ul. Wierzbięcice 1B, 61-569 Poznań, PL',
    phone: '+48 61 647 00 00',
  },
  {
    id: 'place-lidl',
    name: 'Lidl Sp. z o.o. Sp.k.',
    address: 'ul. Poznańska 48, 05-850 Janki, PL',
    phone: '+48 22 542 00 00',
  },
  {
    id: 'place-mcdonalds',
    name: "McDonald's Polska",
    address: 'ul. Postępu 5, 02-676 Warszawa, PL',
    phone: '+48 22 505 00 00',
  },
  {
    id: 'place-orange',
    name: 'Orange Polska S.A.',
    address: 'Al. Jerozolimskie 160, 02-326 Warszawa, PL',
    phone: '+48 510 100 100',
  },
  {
    id: 'place-pkp',
    name: 'PKP Intercity S.A.',
    address: 'Al. Jerozolimskie 142A, 02-305 Warszawa, PL',
    phone: '+48 22 474 00 00',
  },
  {
    id: 'place-mediamarkt',
    name: 'MediaMarkt Polska',
    address: 'Al. Jerozolimskie 179, 02-222 Warszawa, PL',
    phone: '+48 22 460 00 00',
  },
  {
    id: 'place-coffee',
    name: 'Starbucks Coffee Poland',
    address: 'ul. Złota 59, 00-120 Warszawa, PL',
    phone: '+48 22 123 45 67',
  },
];

export const MOCK_GBP_PROFILES: GbpProfile[] = [
  {
    id: '9562330365094939501',
    name: 'Urbaniak Home & Gardens',
    address: 'Głębocka 88, Warszawa, 03-287, PL',
    phone: '+48 501 636 014',
    website: 'https://urbaniak.example',
    description: 'Garden design and home landscaping services in Warsaw.',
    primaryCategory: 'Siedziba firmy',
    directoryCategories: ['Business center'],
    hasEditAccess: true,
  },
  {
    id: '9830981351443153095',
    name: 'Auto Park Ostrowiec',
    address: 'Opatowska 126, Ostrowiec Świętokrzyski, 27-400, PL',
    phone: '+48 512 980 279',
    hasEditAccess: true,
  },
  {
    id: '5758132613399699402',
    name: 'AODC Sp. z o.o.',
    address: 'Działkowa 37, Warszawa, 02-234, PL',
    phone: '+48 22 846 35 15',
    website: 'http://www.aodc.pl/',
    description:
      'AoDC (Art of Data Center) to zespół inżynierów z 20 letnim doświadczeniem w projektowaniu, budowaniu i serwisowaniu obiektów Data Center dla instytucji publicznych i komercyjnych w Polsce.',
    primaryCategory: 'Siedziba firmy',
    directoryCategories: [],
    hasEditAccess: true,
  },
  {
    id: 'prodetektyw-gbp',
    name: 'Agencja Detektywistyczna Pro Detektyw | Biuro Detektywistyczne Warszawa',
    address: 'Mazowiecka 11/49, Warszawa, 00-052, PL',
    phone: '+48 500 156 015',
    hasEditAccess: false,
  },
];

export const MOCK_CATEGORIES: BusinessCategory[] = [
  { id: 'aba', label: 'Applied behavior analysis therapist' },
  { id: 'attractions', label: 'Attractions' },
  { id: 'auto', label: 'Automotive and Transportation', group: 'group' },
  { id: 'boat', label: 'Boat Detailing Service' },
  { id: 'biz', label: 'Businesses and Services', group: 'group' },
  { id: 'carpool', label: 'Carpooling location' },
  { id: 'community', label: 'Community and Government', group: 'group' },
  { id: 'countertop', label: 'Countertop store' },
  { id: 'fiat', label: 'Dealer of Fiat Professional' },
  { id: 'education', label: 'Educational Institutions and Services', group: 'group' },
  { id: 'energy', label: 'Energy advisory service' },
  { id: 'estate', label: 'Estate litigation attorney' },
  { id: 'healthcare', label: 'Healthcare', group: 'group' },
  { id: 'landmarks', label: 'Landmarks', group: 'group' },
  { id: 'quilting', label: 'Longarm quilting service' },
  { id: 'pedorthist', label: 'Pedorthist' },
  { id: 'pet-funeral', label: 'Pet funeral service' },
  { id: 'probate', label: 'Probate attorney' },
  { id: 'retail', label: 'Retail', group: 'group' },
  { id: 'social', label: 'Social and Entertainment', group: 'group' },
  { id: 'sports', label: 'Sports and Recreation', group: 'group' },
  { id: 'training', label: 'Training, Instruction and Classes', group: 'group' },
  { id: 'travel', label: 'Travel', group: 'group' },
  { id: 'hq', label: 'Siedziba firmy' },
  { id: 'biz-center', label: 'Business center' },
];

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function placeKey(place: BusinessPlace): string {
  return `${normalizeText(place.name)}|${normalizeText(place.address)}`;
}

function gbpProfileToPlace(profile: GbpProfile): BusinessPlace {
  return {
    id: `gbp-place-${profile.id}`,
    name: profile.name,
    address: profile.address,
    phone: profile.phone,
  };
}

/** Pełny katalog wizytówek do autocomplete (places + GBP, bez duplikatów). */
export function getSearchablePlaces(): BusinessPlace[] {
  const seen = new Set<string>();
  const catalog: BusinessPlace[] = [];

  for (const place of MOCK_PLACES) {
    const key = placeKey(place);
    if (seen.has(key)) continue;
    seen.add(key);
    catalog.push(place);
  }

  for (const profile of MOCK_GBP_PROFILES) {
    const place = gbpProfileToPlace(profile);
    const key = placeKey(place);
    if (seen.has(key)) continue;
    seen.add(key);
    catalog.push(place);
  }

  return catalog;
}

function placeHaystack(place: BusinessPlace): string {
  const phone = place.phone?.replace(/\s/g, '') ?? '';
  return normalizeText(`${place.name} ${place.address} ${phone}`);
}

function tokenMatchesHaystack(token: string, haystack: string, name: string): boolean {
  if (haystack.includes(token)) return true;

  const normalizedName = normalizeText(name);
  const words = normalizedName.split(' ').filter((w) => w.length > 0);
  return words.some((word) => word.startsWith(token));
}

function scorePlaceMatch(place: BusinessPlace, tokens: string[]): number {
  const haystack = placeHaystack(place);
  const nameNorm = normalizeText(place.name);
  let score = 0;

  for (const token of tokens) {
    if (nameNorm.startsWith(token)) score += 12;
    else if (nameNorm.includes(token)) score += 8;
    else if (tokenMatchesHaystack(token, haystack, place.name)) score += 4;
    else return 0;
  }

  return score;
}

export function searchPlaces(query: string): BusinessPlace[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const tokens = normalizeText(q).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  const catalog = getSearchablePlaces();

  const strict = catalog
    .map((place) => ({ place, score: scorePlaceMatch(place, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name))
    .map((entry) => entry.place);

  if (strict.length > 0) return strict;

  return catalog
    .map((place) => {
      const haystack = placeHaystack(place);
      const nameNorm = normalizeText(place.name);
      let score = 0;
      for (const token of tokens) {
        if (nameNorm.includes(token)) score += 8;
        else if (haystack.includes(token)) score += 4;
        else if (tokenMatchesHaystack(token, haystack, place.name)) score += 2;
      }
      return { place, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name))
    .map((entry) => entry.place);
}

export function findMatchingGbp(place: BusinessPlace): GbpProfile | null {
  const placeName = normalizeText(place.name);
  const placeAddr = normalizeText(place.address);

  let best: GbpProfile | null = null;
  let bestScore = 0;

  for (const profile of MOCK_GBP_PROFILES) {
    const name = normalizeText(profile.name);
    const addr = normalizeText(profile.address);
    let score = 0;
    if (placeName === name || placeName.includes(name) || name.includes(placeName)) score += 3;
    if (placeAddr === addr || placeAddr.includes(addr) || addr.includes(placeAddr)) score += 2;
    if (place.phone && profile.phone && place.phone.replace(/\s/g, '') === profile.phone.replace(/\s/g, '')) {
      score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = profile;
    }
  }

  return bestScore >= 3 ? best : null;
}

export function gbpToBusinessDetails(profile: GbpProfile): BusinessDetails {
  return {
    name: profile.name,
    address: profile.address,
    phone: profile.phone,
    website: profile.website ?? '',
    description: profile.description ?? '',
    hideAddress: false,
    deliversLocally: true,
    serviceAreas: profile.name.includes('AODC') ? ['Gdynia, Polska'] : [],
    googleCategories: profile.primaryCategory ? [profile.primaryCategory] : [],
    directoryCategories: profile.directoryCategories ?? [],
    photoUrls: [],
    hours: [
      { day: 'Monday', status: 'open', openTime: '08:00', closeTime: '16:00' },
      { day: 'Tuesday', status: 'open', openTime: '08:00', closeTime: '16:00' },
      { day: 'Wednesday', status: 'open', openTime: '08:00', closeTime: '16:00' },
      { day: 'Thursday', status: 'open', openTime: '08:00', closeTime: '16:00' },
      { day: 'Friday', status: 'open', openTime: '08:00', closeTime: '16:00' },
      { day: 'Saturday', status: 'closed' },
      { day: 'Sunday', status: 'closed' },
    ],
  };
}

export function placeToBusinessDetails(place: BusinessPlace): BusinessDetails {
  return {
    name: place.name,
    address: place.address,
    phone: place.phone ?? '',
    website: '',
    description: '',
    hideAddress: false,
    deliversLocally: false,
    serviceAreas: [],
    googleCategories: [],
    directoryCategories: [],
    photoUrls: [],
    hours: [
      { day: 'Monday', status: 'open', openTime: '08:00', closeTime: '16:00' },
      { day: 'Tuesday', status: 'open', openTime: '08:00', closeTime: '16:00' },
      { day: 'Wednesday', status: 'open', openTime: '08:00', closeTime: '16:00' },
      { day: 'Thursday', status: 'open', openTime: '08:00', closeTime: '16:00' },
      { day: 'Friday', status: 'open', openTime: '08:00', closeTime: '16:00' },
      { day: 'Saturday', status: 'closed' },
      { day: 'Sunday', status: 'closed' },
    ],
  };
}
