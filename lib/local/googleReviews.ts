import axios from 'axios';
import { isDataForSeoConfigured, locationCodeFor } from '../dataforseo';
import type { ReviewItem, ReviewProgressMonth, ReviewReply } from './reviewsData';

type DfsRating = {
  rating_type?: string;
  value?: number | null;
  votes_count?: number | null;
  rating_max?: number | null;
};

type DfsReviewItem = {
  review_id?: string;
  profile_name?: string;
  review_text?: string | null;
  original_review_text?: string | null;
  time_ago?: string | null;
  timestamp?: string | null;
  rating?: DfsRating | null;
  owner_answer?: string | null;
  original_owner_answer?: string | null;
  owner_time_ago?: string | null;
  owner_timestamp?: string | null;
  owner_response?: string | null;
  reply_text?: string | null;
  review_url?: string | null;
};

type DfsReviewsResult = {
  title?: string;
  reviews_count?: number;
  items_count?: number;
  rating?: DfsRating | null;
  items?: DfsReviewItem[] | null;
};

type DfsTask = {
  id?: string;
  status_code?: number;
  status_message?: string;
  result?: DfsReviewsResult[] | null;
};

type DfsTaskEnvelope = {
  status_code?: number;
  status_message?: string;
  tasks?: DfsTask[];
};

export type GoogleReviewsImportResult = {
  reviews: ReviewItem[];
  totalReviews: number;
  averageRating: number;
  progress: ReviewProgressMonth[];
  source: 'dataforseo';
  businessTitle?: string;
};

function dfsAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN || '';
  const password = process.env.DATAFORSEO_PASSWORD || '';
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
}

function languageCodeFor(country: string): string {
  return country.toUpperCase() === 'PL' ? 'pl' : 'en';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asTrimmedString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function parseDfsTimestamp(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(' ', 'T').replace(' +00:00', 'Z').replace(/ ([+-]\d{2}):(\d{2})$/, '$1$2');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatReviewDateLabel(date: Date, now = new Date()): string {
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

function clampRating(value: number | null | undefined): 1 | 2 | 3 | 4 | 5 {
  const n = Math.round(value ?? 0);
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as 2 | 3 | 4;
}

function truncateReviewText(text: string, max = 240): { text: string; textFull?: string } {
  const cleaned = text.trim();
  if (cleaned.length <= max) return { text: cleaned };
  const cut = cleaned.slice(0, max).replace(/\s+\S*$/, '');
  return { text: `${cut}…`, textFull: cleaned };
}

function combineOriginalAndTranslated(original: string, translated: string): string {
  if (original && translated && original !== translated) {
    return `${original}\n\n(Translated by Google)\n${translated}`;
  }
  return original || translated;
}

function pickReviewBody(item: DfsReviewItem): { text: string; textFull?: string } {
  const raw = combineOriginalAndTranslated(
    asTrimmedString(item.original_review_text),
    asTrimmedString(item.review_text),
  );
  return truncateReviewText(raw);
}

function pickOwnerReplyText(item: DfsReviewItem): string {
  const original = asTrimmedString(item.original_owner_answer);
  const translated = asTrimmedString(item.owner_answer)
    || asTrimmedString(item.owner_response)
    || asTrimmedString(item.reply_text);
  return combineOriginalAndTranslated(original, translated);
}

function mapOwnerReply(
  item: DfsReviewItem,
  businessName: string,
  reviewId: string,
): ReviewReply | null {
  const text = pickOwnerReplyText(item);
  if (!text) return null;
  const date = parseDfsTimestamp(item.owner_timestamp);
  return {
    id: `${reviewId}-reply`,
    author: businessName,
    dateLabel: date ? formatReviewDateLabel(date) : asTrimmedString(item.owner_time_ago),
    text,
    source: 'manual',
  };
}

/** Normalize unknown DFS item shapes into our typed review row. */
export function mapDfsReviewItem(
  item: DfsReviewItem,
  index: number,
  businessName: string,
): ReviewItem {
  const id = asTrimmedString(item.review_id) || `dfs-review-${index}`;
  const date = parseDfsTimestamp(item.timestamp);
  const dateIso = date ? date.toISOString().slice(0, 10) : '';
  const { text, textFull } = pickReviewBody(item);
  const reply = mapOwnerReply(item, businessName, id);

  return {
    id,
    author: asTrimmedString(item.profile_name) || 'Google reviewer',
    rating: clampRating(item.rating?.value ?? undefined),
    dateLabel: date ? formatReviewDateLabel(date) : asTrimmedString(item.time_ago),
    dateIso,
    text,
    textFull,
    repliedByAi: false,
    reply,
  };
}

export function buildProgressFromReviews(
  reviews: ReviewItem[],
  months = 13,
  now = new Date(),
): ReviewProgressMonth[] {
  const buckets: ReviewProgressMonth[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      stars5: 0,
      stars4: 0,
      stars3: 0,
      stars2: 0,
      stars1: 0,
      noRating: 0,
    });
  }

  for (const review of reviews) {
    if (!review.dateIso) continue;
    const d = new Date(`${review.dateIso}T12:00:00`);
    if (Number.isNaN(d.getTime())) continue;
    const offset =
      (now.getFullYear() - d.getFullYear()) * 12
      + (now.getMonth() - d.getMonth());
    if (offset < 0 || offset >= months) continue;
    const bucket = buckets[months - 1 - offset];
    if (!bucket) continue;
    if (review.rating === 5) bucket.stars5 += 1;
    else if (review.rating === 4) bucket.stars4 += 1;
    else if (review.rating === 3) bucket.stars3 += 1;
    else if (review.rating === 2) bucket.stars2 += 1;
    else if (review.rating === 1) bucket.stars1 += 1;
  }

  return buckets;
}

async function postReviewsTask(
  keyword: string,
  country: string,
  depth: number,
): Promise<string> {
  const res = await axios.post(
    'https://api.dataforseo.com/v3/business_data/google/reviews/task_post',
    [{
      keyword,
      location_code: locationCodeFor(country),
      language_code: languageCodeFor(country),
      depth,
      sort_by: 'newest',
    }],
    {
      headers: { Authorization: dfsAuthHeader(), 'Content-Type': 'application/json' },
      timeout: 30000,
    },
  );

  const payload = res.data as DfsTaskEnvelope;
  if (payload.status_code !== 20000) {
    throw new Error(`DataForSEO API ${payload.status_code}: ${payload.status_message}`);
  }
  const task = payload.tasks?.[0];
  const id = task?.id;
  if (!id) {
    throw new Error(`DataForSEO task create failed: ${task?.status_message || 'no id'}`);
  }
  return id;
}

async function getReviewsTask(taskId: string): Promise<DfsTask> {
  const res = await axios.get(
    `https://api.dataforseo.com/v3/business_data/google/reviews/task_get/${taskId}`,
    {
      headers: { Authorization: dfsAuthHeader() },
      timeout: 30000,
    },
  );
  const payload = res.data as DfsTaskEnvelope;
  if (payload.status_code !== 20000) {
    throw new Error(`DataForSEO API ${payload.status_code}: ${payload.status_message}`);
  }
  const task = payload.tasks?.[0];
  if (!task) throw new Error('DataForSEO returned no task');
  return task;
}

async function pollReviewsTask(taskId: string): Promise<DfsReviewsResult> {
  // Queue can sit for a while under load — allow ~2 minutes.
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const task = await getReviewsTask(taskId);
    const code = task.status_code ?? 0;
    if (code === 20000) {
      const result = task.result?.[0];
      if (!result) throw new Error('DataForSEO returned empty reviews result');
      return result;
    }
    if (code === 20100 || code === 40601 || code === 40602 || code === 40600) {
      await sleep(2000);
      continue;
    }
    throw new Error(`DataForSEO task ${code}: ${task.status_message}`);
  }
  throw new Error('DataForSEO reviews task timed out');
}

function averageFromItems(reviews: ReviewItem[], apiAverage?: number | null): number {
  if (typeof apiAverage === 'number' && apiAverage > 0) {
    return Math.round(apiAverage * 10) / 10;
  }
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

function coerceDfsItem(raw: unknown): DfsReviewItem {
  if (!raw || typeof raw !== 'object') return {};
  return raw as DfsReviewItem;
}

export async function importGoogleReviews(
  business: { name: string; address?: string },
  options?: { country?: string; depth?: number },
): Promise<GoogleReviewsImportResult> {
  if (!isDataForSeoConfigured()) {
    throw new Error('DataForSEO is not configured');
  }

  const country = options?.country || 'PL';
  const depth = options?.depth ?? 30;
  const keyword = [business.name, business.address].filter(Boolean).join(' ').trim();
  if (keyword.length < 2) {
    throw new Error('Business name is required to import reviews');
  }

  const taskId = await postReviewsTask(keyword, country, depth);
  const result = await pollReviewsTask(taskId);
  const businessName = asTrimmedString(result.title) || business.name;
  const reviews = (result.items || []).map((item, index) =>
    mapDfsReviewItem(coerceDfsItem(item), index, businessName),
  );

  return {
    reviews,
    totalReviews: result.reviews_count ?? reviews.length,
    averageRating: averageFromItems(reviews, result.rating?.value),
    progress: buildProgressFromReviews(reviews),
    source: 'dataforseo',
    businessTitle: businessName,
  };
}
