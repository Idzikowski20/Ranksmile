// Per-domain Content Templates, stored in the `domain.content_templates` TEXT column
// as a JSON array of Template. Mirrors domainVoices.ts (Surfer's content_template entity).
import db from '@/database/database';
import type { Template } from '@/src/infrastructure/stores/contentSettings';
import type { DbRow } from '@/src/core/shared/types/db';

/** Parse `domain.content_templates` JSON into a Template[]; [] when missing/blank/invalid. */
export async function getDomainTemplates(domainId: number): Promise<Template[]> {
   if (!Number.isInteger(domainId) || domainId <= 0) return [];
   const [rows] = await db.query('SELECT content_templates FROM domain WHERE "ID" = ? LIMIT 1', {
      replacements: [domainId],
   }) as [DbRow[], unknown];
   const raw = rows[0]?.content_templates;
   if (typeof raw !== 'string' || raw.trim() === '') return [];
   try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as Template[] : [];
   } catch {
      return [];
   }
}

/** Persist the templates JSON array onto the domain row. */
export async function setDomainTemplates(domainId: number, templates: Template[]): Promise<void> {
   if (!Number.isInteger(domainId) || domainId <= 0) return;
   await db.query('UPDATE domain SET content_templates = ? WHERE "ID" = ?', {
      replacements: [JSON.stringify(templates), domainId],
   });
}
