import { createHash } from 'crypto';
import { PIPELINE_VERSION } from './queuePriorities';

export type JobKeyParts = {
  workspaceId: string | number;
  keyword: string;
  locale?: string;
  country?: string;
  jobType: string;
  pipelineVersion?: string;
};

/** Stable idempotent key for join-existing / dedupe. */
export function buildJobKey(parts: JobKeyParts): string {
  const keyword = parts.keyword.trim().toLowerCase().replace(/\s+/g, ' ');
  const locale = (parts.locale || 'pl').toLowerCase();
  const country = (parts.country || '').toLowerCase();
  const pv = parts.pipelineVersion || PIPELINE_VERSION;
  const raw = [parts.workspaceId, keyword, locale, country, parts.jobType, pv].join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}
