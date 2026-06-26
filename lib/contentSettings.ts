/**
 * Shared content settings — single source of truth for Brand Knowledge and
 * Custom Voices, used by BOTH the Settings pages and the New-Content wizard.
 * File-backed (data/content-settings.json), same pattern as the IDEAS_*.json store.
 */
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export interface Voice {
  id: string;
  name: string;
  description: string; // tone-of-voice / reference text — drives generation tone
  isDefault: boolean;
}

export interface ContentSettings {
  brandName: string;
  brandKnowledge: string;
  voices: Voice[];
}

const FILE = path.join(process.cwd(), 'data', 'content-settings.json');
const DEFAULTS: ContentSettings = { brandName: '', brandKnowledge: '', voices: [] };

export async function readContentSettings(): Promise<ContentSettings> {
  try {
    const raw = await readFile(FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      brandName: typeof parsed.brandName === 'string' ? parsed.brandName : '',
      brandKnowledge: typeof parsed.brandKnowledge === 'string' ? parsed.brandKnowledge : '',
      voices: Array.isArray(parsed.voices) ? parsed.voices : [],
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function writeContentSettings(partial: Partial<ContentSettings>): Promise<ContentSettings> {
  const current = await readContentSettings();
  const next: ContentSettings = { ...current, ...partial };
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(next, null, 2), 'utf-8');
  } catch {
    // best-effort persistence
  }
  return next;
}
