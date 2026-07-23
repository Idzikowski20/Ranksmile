import { formatReviewDateLabel, buildProgressFromReviews } from './googleReviews';
import type { ReviewItem, ReviewProgressMonth, ReviewReply } from './reviewsData';
import type { GbpProfile } from './types';

const ACCOUNTS_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const LOCATIONS_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const REVIEWS_BASE = 'https://mybusiness.googleapis.com/v4';

const LOCATION_READ_MASK = [
  'name',
  'title',
  'storefrontAddress',
  'phoneNumbers',
  'websiteUri',
  'profile',
  'categories',
  'metadata',
].join(',');

export type GbpApiError = {
  status: number;
  code: 'forbidden' | 'not_found' | 'bad_request' | 'rate_limit' | 'upstream';
  message: string;
};

export type GbpReviewsImportResult = {
  reviews: ReviewItem[];
  totalReviews: number;
  averageRating: number;
  progress: ReviewProgressMonth[];
  source: 'gbp';
  businessTitle?: string;
};

type GbpAccountResource = {
  name?: string;
  accountName?: string;
  type?: string;
};

type GbpPostalAddress = {
  addressLines?: string[];
  locality?: string;
  administrativeArea?: string;
  postalCode?: string;
  regionCode?: string;
};

type GbpLocationResource = {
  name?: string;
  title?: string;
  storefrontAddress?: GbpPostalAddress;
  phoneNumbers?: { primaryPhone?: string };
  websiteUri?: string;
  profile?: { description?: string };
  categories?: {
    primaryCategory?: { displayName?: string };
    additionalCategories?: Array<{ displayName?: string }>;
  };
  metadata?: { hasVoiceOfMerchant?: boolean };
};

type GbpStarRating = 'STAR_RATING_UNSPECIFIED' | 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';

type GbpReviewReply = {
  comment?: string;
  updateTime?: string;
};

type GbpReviewResource = {
  name?: string;
  reviewId?: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
  starRating?: GbpStarRating;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: GbpReviewReply | null;
};

function asTrimmedString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

/** Strip `accounts/` or `locations/` prefix from a resource name segment. */
export function stripResourcePrefix(name: string, kind: 'accounts' | 'locations'): string {
  const trimmed = name.trim();
  const prefix = `${kind}/`;
  if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  // Full path: accounts/123/locations/456 → last segment for locations
  if (kind === 'locations') {
    const parts = trimmed.split('/');
    const locIdx = parts.indexOf('locations');
    if (locIdx >= 0 && parts[locIdx + 1]) return parts[locIdx + 1];
  }
  if (kind === 'accounts') {
    const parts = trimmed.split('/');
    const accIdx = parts.indexOf('accounts');
    if (accIdx >= 0 && parts[accIdx + 1]) return parts[accIdx + 1];
  }
  return trimmed;
}

export function parseAccountId(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const parts = trimmed.split('/').filter(Boolean);
  const accIdx = parts.indexOf('accounts');
  if (accIdx >= 0 && parts[accIdx + 1] && parts[accIdx + 1] !== 'locations') {
    return parts[accIdx + 1];
  }
  // Bare numeric / opaque account id (not a locations/… BI resource name)
  if (parts.length === 1 && parts[0] !== 'locations') return parts[0];
  return '';
}

export function parseLocationId(name: string): string {
  return stripResourcePrefix(name, 'locations');
}

function formatAddress(addr: GbpPostalAddress | undefined): string {
  if (!addr) return '';
  const lines = (addr.addressLines || []).map((l) => l.trim()).filter(Boolean);
  const cityBits = [addr.postalCode, addr.locality, addr.administrativeArea]
    .map((x) => (x || '').trim())
    .filter(Boolean);
  return [...lines, cityBits.join(' ')].filter(Boolean).join(', ');
}

function starRatingToNumber(rating: GbpStarRating | undefined): 1 | 2 | 3 | 4 | 5 {
  switch (rating) {
    case 'ONE': return 1;
    case 'TWO': return 2;
    case 'THREE': return 3;
    case 'FOUR': return 4;
    case 'FIVE': return 5;
    default: return 5;
  }
}

function truncateReviewText(text: string, max = 240): { text: string; textFull?: string } {
  const cleaned = text.trim();
  if (cleaned.length <= max) return { text: cleaned };
  const cut = cleaned.slice(0, max).replace(/\s+\S*$/, '');
  return { text: `${cut}…`, textFull: cleaned };
}

async function gbpFetch<T>(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Google GBP API ${res.status}`;
    try {
      const body = await res.json() as { error?: { message?: string; status?: string } };
      if (body.error?.message) message = body.error.message;
    } catch { /* ignore */ }
    const quotaHit = res.status === 429
      || /quota exceeded|rate limit|requests per minute/i.test(message);
    const code: GbpApiError['code'] =
      quotaHit ? 'rate_limit'
        : res.status === 403 ? 'forbidden'
          : res.status === 404 ? 'not_found'
            : res.status === 400 ? 'bad_request'
              : 'upstream';
    const err: GbpApiError = { status: quotaHit ? 429 : res.status, code, message };
    throw err;
  }

  if (res.status === 204) {
    return {} as T;
  }

  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export function isGbpApiError(err: unknown): err is GbpApiError {
  return Boolean(
    err
    && typeof err === 'object'
    && 'status' in err
    && 'code' in err
    && 'message' in err,
  );
}

export async function listGbpAccounts(accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const data = await gbpFetch<{ accounts?: GbpAccountResource[] }>(accessToken, ACCOUNTS_URL);
  return (data.accounts || [])
    .map((acc) => {
      const id = parseAccountId(asTrimmedString(acc.name));
      if (!id) return null;
      return {
        id,
        name: asTrimmedString(acc.accountName) || id,
      };
    })
    .filter((x): x is { id: string; name: string } => Boolean(x));
}

export function mapGbpLocationToProfile(
  location: GbpLocationResource,
  accountId?: string,
): GbpProfile | null {
  const rawName = asTrimmedString(location.name);
  const locationId = parseLocationId(rawName);
  const resolvedAccountId = (accountId && accountId.trim())
    || parseAccountId(rawName);
  if (!locationId || !resolvedAccountId) return null;
  const primary = asTrimmedString(location.categories?.primaryCategory?.displayName);
  const additional = (location.categories?.additionalCategories || [])
    .map((c) => asTrimmedString(c.displayName))
    .filter(Boolean);

  return {
    id: locationId,
    accountId: resolvedAccountId,
    locationId,
    name: asTrimmedString(location.title) || 'Google Business Profile',
    address: formatAddress(location.storefrontAddress),
    phone: asTrimmedString(location.phoneNumbers?.primaryPhone),
    website: asTrimmedString(location.websiteUri) || undefined,
    description: asTrimmedString(location.profile?.description) || undefined,
    primaryCategory: primary || undefined,
    additionalGoogleCategories: additional.length ? additional : undefined,
    hasEditAccess: Boolean(location.metadata?.hasVoiceOfMerchant ?? true),
  };
}

async function listGbpLocationsPaged(
  accessToken: string,
  accountId: string,
): Promise<GbpProfile[]> {
  const profiles: GbpProfile[] = [];
  let pageToken = '';
  do {
    const qs = new URLSearchParams({
      readMask: LOCATION_READ_MASK,
      pageSize: '100',
    });
    if (pageToken) qs.set('pageToken', pageToken);
    const url = `${LOCATIONS_BASE}/accounts/${accountId}/locations?${qs.toString()}`;
    const data = await gbpFetch<{ locations?: GbpLocationResource[]; nextPageToken?: string }>(
      accessToken,
      url,
    );
    for (const loc of data.locations || []) {
      const profile = mapGbpLocationToProfile(loc, accountId === '-' ? undefined : accountId);
      if (profile) profiles.push(profile);
    }
    pageToken = asTrimmedString(data.nextPageToken);
  } while (pageToken);
  return profiles;
}

export async function listGbpLocations(
  accessToken: string,
  accountId: string,
): Promise<GbpProfile[]> {
  return listGbpLocationsPaged(accessToken, accountId);
}

type AccountsCacheEntry = {
  expiresAt: number;
  accounts: Array<{ id: string; name: string }>;
};

type LocationsCacheEntry = {
  expiresAt: number;
  locations: GbpProfile[];
};

type RateLimitCooldown = {
  until: number;
  message: string;
};

/** Account Management has tiny RPM — cache aggressively. */
const ACCOUNTS_CACHE_TTL_MS = 60 * 60 * 1000;
const LOCATIONS_CACHE_TTL_MS = 5 * 60 * 1000;
/** After a 429, don't re-hit Google until cooldown ends (Retry spam). */
const RATE_LIMIT_COOLDOWN_MS = 90 * 1000;

const accountsCache = new Map<string, AccountsCacheEntry>();
const locationsCache = new Map<string, LocationsCacheEntry>();
const rateLimitCooldown = new Map<string, RateLimitCooldown>();
const locationsInflight = new Map<string, Promise<GbpProfile[]>>();

/**
 * Business Information location `name` is usually `locations/{id}` (no account).
 * Listing via `accounts/-` therefore maps to zero usable profiles and always fell
 * through to Account Management — burning the scarce AM quota on every request.
 *
 * Correct path: AM `accounts.list` (cached 1h) → BI `accounts/{id}/locations`.
 */
export async function listAllGbpLocations(
  accessToken: string,
  opts?: { accountIds?: string[]; accountsCacheKey?: string },
): Promise<GbpProfile[]> {
  let accounts: Array<{ id: string; name: string }>;

  if (opts?.accountIds?.length) {
    accounts = opts.accountIds.map((id) => ({ id, name: id }));
  } else {
    const cacheKey = opts?.accountsCacheKey || '_anon';
    const now = Date.now();
    const cached = accountsCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      accounts = cached.accounts;
    } else {
      accounts = await listGbpAccounts(accessToken);
      accountsCache.set(cacheKey, {
        expiresAt: now + ACCOUNTS_CACHE_TTL_MS,
        accounts,
      });
    }
  }

  const all: GbpProfile[] = [];
  for (const account of accounts) {
    try {
      const locs = await listGbpLocationsPaged(accessToken, account.id);
      all.push(...locs);
    } catch (err) {
      if (isGbpApiError(err) && (err.code === 'forbidden' || err.code === 'not_found')) {
        continue;
      }
      throw err;
    }
  }
  return all;
}

function rateLimitError(message: string): GbpApiError {
  return {
    status: 429,
    code: 'rate_limit',
    message,
  };
}

/** Per-user cache + in-flight dedupe + 429 cooldown (React Strict Mode / remounts). */
export async function listAllGbpLocationsCached(
  cacheKey: string,
  accessToken: string,
  opts?: { accountIds?: string[] },
): Promise<GbpProfile[]> {
  const now = Date.now();

  const cooling = rateLimitCooldown.get(cacheKey);
  if (cooling && cooling.until > now) {
    throw rateLimitError(cooling.message);
  }

  const cached = locationsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.locations;
  }

  const existing = locationsInflight.get(cacheKey);
  if (existing) return existing;

  const pending = listAllGbpLocations(accessToken, {
    accountIds: opts?.accountIds,
    accountsCacheKey: cacheKey,
  })
    .then((locations) => {
      locationsCache.set(cacheKey, {
        expiresAt: Date.now() + LOCATIONS_CACHE_TTL_MS,
        locations,
      });
      rateLimitCooldown.delete(cacheKey);
      return locations;
    })
    .catch((err: unknown) => {
      if (isGbpApiError(err) && err.code === 'rate_limit') {
        rateLimitCooldown.set(cacheKey, {
          until: Date.now() + RATE_LIMIT_COOLDOWN_MS,
          message: err.message,
        });
      }
      throw err;
    })
    .finally(() => {
      locationsInflight.delete(cacheKey);
    });

  locationsInflight.set(cacheKey, pending);
  return pending;
}

/** Test helper — clears in-memory GBP list caches. */
export function __resetGbpLocationsCachesForTests(): void {
  accountsCache.clear();
  locationsCache.clear();
  rateLimitCooldown.clear();
  locationsInflight.clear();
}

export function parseReviewId(nameOrId: string): string {
  const trimmed = nameOrId.trim();
  if (!trimmed.includes('/')) return trimmed;
  const parts = trimmed.split('/');
  const revIdx = parts.indexOf('reviews');
  if (revIdx >= 0 && parts[revIdx + 1]) return parts[revIdx + 1];
  return parts[parts.length - 1] || trimmed;
}

export function mapGbpReviewToItem(
  review: GbpReviewResource,
  businessName: string,
  index: number,
): ReviewItem {
  const reviewId = asTrimmedString(review.reviewId)
    || parseReviewId(asTrimmedString(review.name))
    || `gbp-review-${index}`;
  const created = asTrimmedString(review.createTime);
  const createdDate = created ? new Date(created) : null;
  const validDate = createdDate && !Number.isNaN(createdDate.getTime()) ? createdDate : null;
  const body = truncateReviewText(asTrimmedString(review.comment));

  let reply: ReviewReply | null = null;
  const replyComment = asTrimmedString(review.reviewReply?.comment);
  if (replyComment) {
    const replyUpdated = asTrimmedString(review.reviewReply?.updateTime);
    const replyDate = replyUpdated ? new Date(replyUpdated) : null;
    const validReplyDate = replyDate && !Number.isNaN(replyDate.getTime()) ? replyDate : null;
    reply = {
      id: `${reviewId}-reply`,
      author: businessName,
      dateLabel: validReplyDate ? formatReviewDateLabel(validReplyDate) : '',
      text: replyComment,
      source: 'manual',
    };
  }

  return {
    id: reviewId,
    author: asTrimmedString(review.reviewer?.displayName)
      || (review.reviewer?.isAnonymous ? 'Anonymous' : 'Google reviewer'),
    rating: starRatingToNumber(review.starRating),
    dateLabel: validDate ? formatReviewDateLabel(validDate) : '',
    dateIso: validDate ? validDate.toISOString().slice(0, 10) : '',
    text: body.text,
    textFull: body.textFull,
    repliedByAi: false,
    reply,
  };
}

export async function listGbpReviews(
  accessToken: string,
  accountId: string,
  locationId: string,
  businessName = 'Business',
): Promise<GbpReviewsImportResult> {
  const path = `accounts/${accountId}/locations/${locationId}/reviews`;
  const reviews: ReviewItem[] = [];
  let pageToken = '';
  let averageRating = 0;
  let totalReviewCount = 0;

  do {
    const qs = new URLSearchParams({ pageSize: '50' });
    if (pageToken) qs.set('pageToken', pageToken);
    const data = await gbpFetch<{
      reviews?: GbpReviewResource[];
      averageRating?: number;
      totalReviewCount?: number;
      nextPageToken?: string;
    }>(accessToken, `${REVIEWS_BASE}/${path}?${qs.toString()}`);

    const batch = data.reviews || [];
    for (let i = 0; i < batch.length; i += 1) {
      reviews.push(mapGbpReviewToItem(batch[i]!, businessName, reviews.length + i));
    }
    if (typeof data.averageRating === 'number') averageRating = data.averageRating;
    if (typeof data.totalReviewCount === 'number') totalReviewCount = data.totalReviewCount;
    pageToken = asTrimmedString(data.nextPageToken);
  } while (pageToken);

  const totalReviews = totalReviewCount || reviews.length;
  const avg = averageRating
    || (reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0);

  return {
    reviews,
    totalReviews,
    averageRating: Math.round(avg * 10) / 10,
    progress: buildProgressFromReviews(reviews),
    source: 'gbp',
    businessTitle: businessName,
  };
}

function reviewReplyUrl(accountId: string, locationId: string, reviewId: string): string {
  return `${REVIEWS_BASE}/accounts/${accountId}/locations/${locationId}/reviews/${encodeURIComponent(reviewId)}/reply`;
}

export async function updateReviewReply(
  accessToken: string,
  accountId: string,
  locationId: string,
  reviewId: string,
  comment: string,
): Promise<{ comment: string; updateTime?: string }> {
  const data = await gbpFetch<{ comment?: string; updateTime?: string }>(
    accessToken,
    reviewReplyUrl(accountId, locationId, reviewId),
    {
      method: 'PUT',
      body: JSON.stringify({ comment }),
    },
  );
  return {
    comment: asTrimmedString(data.comment) || comment,
    updateTime: asTrimmedString(data.updateTime) || undefined,
  };
}

export async function deleteReviewReply(
  accessToken: string,
  accountId: string,
  locationId: string,
  reviewId: string,
): Promise<void> {
  await gbpFetch<Record<string, never>>(
    accessToken,
    reviewReplyUrl(accountId, locationId, reviewId),
    { method: 'DELETE' },
  );
}
