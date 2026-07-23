export type ListingStatus =
  | 'connected'
  | 'submitted'
  | 'processing'
  | 'disconnected'
  | 'unavailable'
  | 'needs_connect';

export type DirectoryListing = {
  id: string;
  name: string;
  iconUrl: string;
  status: ListingStatus;
  parentBrand?: string;
  listingUrl?: string | null;
  detailMessage?: string;
  showOptOut?: boolean;
  connectProvider?: 'facebook' | 'instagram';
};

const ICON_BASE = 'https://static.semrush.com/listing-management/local-ui-kit/publisher-icons';

export const LISTING_STATUS_META: Record<
  Exclude<ListingStatus, 'needs_connect'>,
  { label: string; legendColor: string; tagColor: string }
> = {
  connected: { label: 'Connected', legendColor: '#2ECDA7', tagColor: '#1A9E72' },
  submitted: { label: 'Submitted', legendColor: '#7BDEB8', tagColor: '#2ECDA7' },
  processing: { label: 'Processing', legendColor: '#6C8CFF', tagColor: '#4B6BFB' },
  disconnected: { label: 'Disconnected', legendColor: '#DAD9DE', tagColor: '#6A6772' },
  unavailable: { label: 'Unavailable', legendColor: '#F26564', tagColor: '#E5484D' },
};

/** Katalogi, do których zgłaszamy wizytówkę (mock — jak Semrush Listing Management). */
export const MOCK_DIRECTORY_LISTINGS: DirectoryListing[] = [
  {
    id: 'infoisinfo',
    name: 'infoisinfo',
    iconUrl: `${ICON_BASE}/infoisinfo.svg`,
    status: 'processing',
    detailMessage: 'Your business data is being added to the directory.',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    iconUrl: `${ICON_BASE}/instagram.svg`,
    status: 'needs_connect',
    connectProvider: 'instagram',
    detailMessage: 'Please grant access to your Instagram page to auto-populate your business data there.',
  },
  {
    id: 'tripadvisor',
    name: 'TripAdvisor',
    iconUrl: `${ICON_BASE}/tripadvisor.svg`,
    status: 'processing',
    detailMessage: 'Your business data is being added to the directory.',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    iconUrl: `${ICON_BASE}/facebook.svg`,
    status: 'needs_connect',
    connectProvider: 'facebook',
    detailMessage: 'Please grant access to your Facebook page to auto-populate your business data there.',
  },
  {
    id: 'acompio',
    name: 'acompio',
    iconUrl: `${ICON_BASE}/acompio.png`,
    status: 'connected',
    listingUrl: 'https://www.acompio.pl/AODC-Sp.-z-o.o.-47763849.html',
  },
  {
    id: 'apple-maps',
    name: 'Apple Maps',
    iconUrl: `${ICON_BASE}/APPLE_MAPS.png`,
    status: 'connected',
    listingUrl: 'https://maps.apple.com/place?auid=4507362970700015723',
  },
  {
    id: 'audi',
    name: 'Audi',
    iconUrl: `${ICON_BASE}/AUDI.png`,
    status: 'connected',
  },
  {
    id: 'bing',
    name: 'Bing',
    iconUrl: `${ICON_BASE}/bing.svg`,
    status: 'connected',
  },
  {
    id: 'bmw',
    name: 'BMW',
    iconUrl: `${ICON_BASE}/BMW.png`,
    status: 'connected',
  },
  {
    id: 'cylex',
    name: 'Cylex',
    iconUrl: `${ICON_BASE}/cylex.svg`,
    status: 'connected',
    listingUrl: 'https://www.cylex-polska.pl/firmy/aodc-sp--z-o-o--14526141.html',
  },
  {
    id: 'fiat',
    name: 'Fiat',
    iconUrl: `${ICON_BASE}/FIAT.png`,
    status: 'connected',
  },
  {
    id: 'find-open',
    name: 'Find Open',
    iconUrl: `${ICON_BASE}/findopen.svg`,
    status: 'connected',
    listingUrl: 'https://teraz-otwarte.pl/warszawa/aodc-sp-z-oo-4402930',
  },
  {
    id: 'ford',
    name: 'Ford',
    iconUrl: `${ICON_BASE}/FORD.png`,
    status: 'connected',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    iconUrl: `${ICON_BASE}/gemini.svg`,
    status: 'connected',
    parentBrand: 'by Google Business Profile',
    showOptOut: true,
  },
  {
    id: 'gm',
    name: 'GM',
    iconUrl: `${ICON_BASE}/GM.png`,
    status: 'connected',
  },
  {
    id: 'google',
    name: 'Google Business Profile',
    iconUrl: `${ICON_BASE}/google.svg`,
    status: 'connected',
    listingUrl: 'https://maps.google.com/maps?cid=2180557446068828658',
    showOptOut: true,
  },
  {
    id: 'hotfrog',
    name: 'Hotfrog',
    iconUrl: `${ICON_BASE}/hotfrog.svg`,
    status: 'connected',
    listingUrl: 'https://www.hotfrog.pl/company/1f8149e0b68459d7473980cc3e12d147',
  },
  {
    id: 'infobel',
    name: 'Infobel',
    iconUrl: `${ICON_BASE}/infobel.svg`,
    status: 'connected',
    listingUrl: 'https://www.infobel.com/pl/poland/aodc_sp_z_o_o_/warszawa/PL103735905-228463515/businessdetails.aspx',
  },
  {
    id: 'mercedes',
    name: 'Mercedes',
    iconUrl: `${ICON_BASE}/MERCEDES.png`,
    status: 'connected',
  },
  {
    id: 'navmii',
    name: 'Navmii',
    iconUrl: `${ICON_BASE}/navmii.svg`,
    status: 'connected',
    listingUrl: 'https://livepoi.navmii.com/p/view/14b07977-ab3b-488a-8485-55243fba2f82',
  },
  {
    id: 'opendi',
    name: 'Opendi',
    iconUrl: `${ICON_BASE}/medallion-stadtbranchenbuch.svg`,
    status: 'connected',
    listingUrl: 'https://www.opendi.pl/warszawa/669311.html',
  },
  {
    id: 'petal',
    name: 'Petal Search',
    iconUrl: `${ICON_BASE}/HUAWEI.png`,
    status: 'connected',
  },
  {
    id: 'showmelocal',
    name: 'ShowMeLocal',
    iconUrl: `${ICON_BASE}/showmelocal.svg`,
    status: 'connected',
    listingUrl: 'https://global.showmelocal.com/profile.aspx?bid=40163391',
  },
  {
    id: 'siri',
    name: 'Siri',
    iconUrl: `${ICON_BASE}/SIRI.png`,
    status: 'connected',
  },
  {
    id: 'toyota',
    name: 'Toyota',
    iconUrl: `${ICON_BASE}/TOYOTA.png`,
    status: 'connected',
  },
  {
    id: 'tupalo',
    name: 'Tupalo',
    iconUrl: `${ICON_BASE}/tupalo.svg`,
    status: 'connected',
    listingUrl: 'https://www.tupalo.pl/warszawa/aodc-sp-z-o-o',
  },
  {
    id: 'vw',
    name: 'VW',
    iconUrl: `${ICON_BASE}/VW.png`,
    status: 'connected',
  },
  {
    id: 'waze',
    name: 'Waze',
    iconUrl: `${ICON_BASE}/waze.svg`,
    status: 'connected',
    parentBrand: 'by Google Business Profile',
    showOptOut: true,
  },
  {
    id: 'foursquare',
    name: 'Foursquare',
    iconUrl: `${ICON_BASE}/foursquare.svg`,
    status: 'submitted',
  },
  {
    id: 'here',
    name: 'HERE',
    iconUrl: `${ICON_BASE}/here.svg`,
    status: 'submitted',
  },
  {
    id: 'tomtom',
    name: 'TomTom',
    iconUrl: `${ICON_BASE}/tomtom.svg`,
    status: 'submitted',
  },
  {
    id: 'uber',
    name: 'Uber',
    iconUrl: `${ICON_BASE}/uber.svg`,
    status: 'submitted',
  },
  {
    id: 'whereto',
    name: 'Where To?',
    iconUrl: `${ICON_BASE}/whereto.png`,
    status: 'submitted',
  },
];

export type ListingStatusCounts = {
  connected: number;
  submitted: number;
  processing: number;
  disconnected: number;
  unavailable: number;
  total: number;
};

/** `needs_connect` liczymy w Unavailable (jak brak dostępu do katalogu). */
export function countListingStatuses(listings: DirectoryListing[]): ListingStatusCounts {
  const counts: ListingStatusCounts = {
    connected: 0,
    submitted: 0,
    processing: 0,
    disconnected: 0,
    unavailable: 0,
    total: listings.length,
  };
  for (const row of listings) {
    if (row.status === 'needs_connect') {
      counts.unavailable += 1;
    } else {
      counts[row.status] += 1;
    }
  }
  return counts;
}

export type StatusFilterValue = '' | 'CONNECTED' | 'SUBMITTED' | 'PROCESSING' | 'DISCONNECTED' | 'UNAVAILABLE';

export function listingMatchesFilter(listing: DirectoryListing, filter: StatusFilterValue): boolean {
  if (!filter) return true;
  if (filter === 'UNAVAILABLE') {
    return listing.status === 'unavailable' || listing.status === 'needs_connect';
  }
  const map: Record<Exclude<StatusFilterValue, ''>, ListingStatus> = {
    CONNECTED: 'connected',
    SUBMITTED: 'submitted',
    PROCESSING: 'processing',
    DISCONNECTED: 'disconnected',
    UNAVAILABLE: 'unavailable',
  };
  return listing.status === map[filter];
}

export function sortListingsByStatus(listings: DirectoryListing[], ascending: boolean): DirectoryListing[] {
  const order: ListingStatus[] = [
    'processing',
    'needs_connect',
    'connected',
    'submitted',
    'disconnected',
    'unavailable',
  ];
  return [...listings].sort((a, b) => {
    const diff = order.indexOf(a.status) - order.indexOf(b.status);
    return ascending ? diff : -diff;
  });
}
