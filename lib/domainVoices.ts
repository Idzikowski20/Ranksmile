// Per-domain Custom Voices, stored in the `domain.voices` TEXT column as a JSON
// array of Voice. Replaces the global content-settings.json store for voices.
import db from '../database/database';
import type { Voice } from './contentSettings';
import type { DbRow } from './types/db';

/** Parse `domain.voices` JSON into a Voice[]; returns [] when missing/blank/invalid. */
export async function getDomainVoices(domainId: number): Promise<Voice[]> {
   if (!Number.isInteger(domainId) || domainId <= 0) return [];
   const [rows] = await db.query('SELECT voices FROM domain WHERE "ID" = ? LIMIT 1', {
      replacements: [domainId],
   }) as [DbRow[], unknown];
   const raw = rows[0]?.voices;
   if (typeof raw !== 'string' || raw.trim() === '') return [];
   try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as Voice[] : [];
   } catch {
      return [];
   }
}

/** Persist the voices JSON array onto the domain row. */
export async function setDomainVoices(domainId: number, voices: Voice[]): Promise<void> {
   if (!Number.isInteger(domainId) || domainId <= 0) return;
   await db.query('UPDATE domain SET voices = ? WHERE "ID" = ?', {
      replacements: [JSON.stringify(voices), domainId],
   });
}
