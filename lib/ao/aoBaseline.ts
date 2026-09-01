import { createHash } from 'crypto';
import { normalizeHtmlForDiff } from '../articleSections';
import type { AoScores } from './aoScoreDelta';

export type AoBaseline = {
  runId: string;
  documentHash: string;
  scores: AoScores;
  wordCount: number;
  sectionCount: number;
  capturedAt: string;
};

export function hashDocument(html: string): string {
  const normalized = normalizeHtmlForDiff(html);
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export function countWordsFromHtml(html: string): number {
  const t = (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t ? t.split(/\s+/).length : 0;
}

export function captureAoBaseline(opts: {
  runId: string;
  html: string;
  scores: AoScores;
  sectionCount: number;
}): AoBaseline {
  return {
    runId: opts.runId,
    documentHash: hashDocument(opts.html),
    scores: { ...opts.scores },
    wordCount: countWordsFromHtml(opts.html),
    sectionCount: opts.sectionCount,
    capturedAt: new Date().toISOString(),
  };
}

/** Byte-identical after normalize — for full rollback checks. */
export function htmlMatchesNormalized(a: string, b: string): boolean {
  return normalizeHtmlForDiff(a) === normalizeHtmlForDiff(b);
}
