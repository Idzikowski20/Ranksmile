/**
 * Competitor Intelligence — structural profiles from measurable inputs.
 */
import type { CompetitorProfile } from './types';

export type CompetitorRawInput = {
  url: string;
  position?: number;
  authority?: number;
  wordCount?: number;
  paragraphs?: number;
  headings?: number;
  images?: number;
  tables?: number;
  lists?: number;
  faq?: number;
  examples?: number;
  caseStudies?: number;
  claims?: string[];
  questions?: string[];
  entities?: string[];
  sources?: string[];
  statistics?: string[];
  openingPattern?: CompetitorProfile['openingPattern'];
  closingPattern?: CompetitorProfile['closingPattern'];
};

export function buildCompetitorProfile(raw: CompetitorRawInput, index: number): CompetitorProfile {
  return {
    url: raw.url,
    position: raw.position ?? index + 1,
    authority: clamp01(raw.authority ?? 0.5),
    wordCount: Math.max(0, raw.wordCount ?? 0),
    paragraphs: Math.max(0, raw.paragraphs ?? 0),
    headings: Math.max(0, raw.headings ?? 0),
    images: Math.max(0, raw.images ?? 0),
    tables: Math.max(0, raw.tables ?? 0),
    lists: Math.max(0, raw.lists ?? 0),
    faq: Math.max(0, raw.faq ?? 0),
    examples: Math.max(0, raw.examples ?? 0),
    caseStudies: Math.max(0, raw.caseStudies ?? 0),
    claims: (raw.claims ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 80),
    questions: (raw.questions ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 40),
    entities: (raw.entities ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 60),
    sources: (raw.sources ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 40),
    statistics: (raw.statistics ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 40),
    openingPattern: raw.openingPattern ?? 'unknown',
    closingPattern: raw.closingPattern ?? 'unknown',
  };
}

export function buildCompetitorProfiles(raws: CompetitorRawInput[]): CompetitorProfile[] {
  return raws.filter((r) => r.url).map((r, i) => buildCompetitorProfile(r, i));
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
