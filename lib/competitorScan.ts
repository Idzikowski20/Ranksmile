// Shared "Organic Competitors" store, keyed by (domain_id, keyword). Scans the top-10
// SERP via the sidecar /competitor-outlines, scores each result relative to the peer set
// (word/heading median), decorates it with a DataForSEO domain rank (Authority), and
// upserts into domain_serp_competitors WITHOUT clobbering the user's `selected` toggle.
// Used by both the Audit tool and the Content Editor via the shared modal.
import db from '../database/database';
import { queryRows } from './db/query';
import { callSidecar } from './sidecar';
import { domainRanks } from './dataforseo';
import { CompetitorDTO, CompetitorRow, rowToCompetitorDTO } from './competitorTypes';

/** Shape of one competitor returned by the sidecar /competitor-outlines endpoint. */
interface SidecarCompetitor {
   url: string;
   domain: string;
   title: string;
   snippet: string;
   word_count: number;
   heading_count: number;
   serp_position: number;
   headings?: Array<{ level: number; text: string }>;
}

interface SidecarResponse {
   competitors?: SidecarCompetitor[];
}

/* ── Per-competitor content score (relative to peer group) ──────────
 * Replicated from components/articles/ResearchOutlinePanel.tsx competitorScore:
 * 0-100 based on word/heading count vs the median of the set (70% words / 30% headings). */
function competitorScore(comp: SidecarCompetitor, allComps: SidecarCompetitor[]): number {
   if (allComps.length === 0) return 0;

   const words = allComps.map((c) => c.word_count ?? 0).filter((n) => n > 0);
   const headings = allComps.map((c) => c.heading_count).filter((n) => n > 0);

   const medianWords = words.length ? words.slice().sort((a, b) => a - b)[Math.floor(words.length / 2)] : 1;
   const medianHeadings = headings.length ? headings.slice().sort((a, b) => a - b)[Math.floor(headings.length / 2)] : 1;

   // Word score: 1 = at median, diminishing returns above, penalised below
   const wordScore = comp.word_count && comp.word_count > 0
      ? Math.min((comp.word_count / medianWords) * 100, 100)
      : 0;

   // Heading score: 1 = at median
   const headingScore = comp.heading_count > 0
      ? Math.min((comp.heading_count / medianHeadings) * 100, 100)
      : 0;

   // 70% word count, 30% heading structure
   return Math.round(wordScore * 0.7 + headingScore * 0.3);
}

const stripWww = (host: string): string => host.replace(/^www\./, '');

/** Preserve the user's `selected` toggle on conflict — every other column is refreshed. */
const ON_CONFLICT = `ON CONFLICT (domain_id, keyword, url) DO UPDATE SET
   position = EXCLUDED.position,
   domain = EXCLUDED.domain,
   title = EXCLUDED.title,
   snippet = EXCLUDED.snippet,
   word_count = EXCLUDED.word_count,
   heading_count = EXCLUDED.heading_count,
   seo_score = EXCLUDED.seo_score,
   authority = EXCLUDED.authority`;

/**
 * Scan the top-10 organic competitors for (domainId, keyword), score + decorate them,
 * and upsert into the shared store. Returns the freshly stored set.
 */
export async function scanCompetitors(domainId: number, keyword: string, language?: string): Promise<CompetitorDTO[]> {
   const response = await callSidecar<SidecarResponse>(
      '/competitor-outlines',
      { keyword, language: language || 'pl', num: 10 },
      60000,
   );
   const competitors = (response.competitors || []).slice(0, 10);

   // Authority per host (best-effort — DataForSEO is optional; {} on failure/unconfigured).
   let ranks: Record<string, number> = {};
   try {
      const distinctDomains = Array.from(new Set(competitors.map((c) => c.domain).filter(Boolean)));
      if (distinctDomains.length) ranks = await domainRanks(distinctDomains);
   } catch {
      ranks = {};
   }

   for (let i = 0; i < competitors.length; i += 1) {
      const comp = competitors[i];
      const seoScore = competitorScore(comp, competitors);
      const position = typeof comp.serp_position === 'number' && comp.serp_position > 0 ? comp.serp_position : i + 1;
      const authority = ranks[stripWww(comp.domain || '')] ?? null;

      const replacements = [
         domainId, keyword, position, comp.url, comp.domain || '', comp.title || '',
         comp.snippet || '', comp.word_count ?? 0, comp.heading_count ?? 0, seoScore, authority,
      ];
      await db.query(
         `INSERT INTO domain_serp_competitors
            (domain_id, keyword, position, url, domain, title, snippet, word_count, heading_count, seo_score, authority)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ${ON_CONFLICT}`,
         { replacements },
      );
   }

   return getCompetitors(domainId, keyword);
}

/** Read the stored competitors for (domainId, keyword), ordered by SERP position. */
export async function getCompetitors(domainId: number, keyword: string): Promise<CompetitorDTO[]> {
   const rows = await queryRows<CompetitorRow>(
      'SELECT * FROM domain_serp_competitors WHERE domain_id = ? AND keyword = ? ORDER BY position ASC',
      [domainId, keyword],
   );
   return rows.map(rowToCompetitorDTO);
}

/**
 * Set which competitors count (drive the audit charts / editor targets): rows in
 * `selectedIds` → selected=1, the rest for this (domainId, keyword) → selected=0.
 */
export async function setSelection(domainId: number, keyword: string, selectedIds: number[]): Promise<void> {
   const ids = selectedIds.filter((n) => typeof n === 'number' && Number.isFinite(n));

   if (ids.length === 0) {
      await db.query(
         'UPDATE domain_serp_competitors SET selected = 0 WHERE domain_id = ? AND keyword = ?',
         { replacements: [domainId, keyword] },
      );
      return;
   }

   const placeholders = ids.map(() => '?').join(', ');
   await db.query(
      `UPDATE domain_serp_competitors SET selected = 1 WHERE domain_id = ? AND keyword = ? AND id IN (${placeholders})`,
      { replacements: [domainId, keyword, ...ids] },
   );
   await db.query(
      `UPDATE domain_serp_competitors SET selected = 0 WHERE domain_id = ? AND keyword = ? AND id NOT IN (${placeholders})`,
      { replacements: [domainId, keyword, ...ids] },
   );
}
