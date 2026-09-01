/**
 * Optional GOLD / BAD corpora for WIE Learning (curated exemplars ≠ SERP dump).
 */
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export type CorpusKind = 'gold' | 'bad';

export type CorpusEntry = {
  id: string;
  kind: CorpusKind;
  url?: string;
  title?: string;
  note?: string;
  industry?: string;
  added_at: string;
};

type CorpusFile = { entries: CorpusEntry[] };

const FILE = path.join(process.cwd(), 'data', 'wie-gold-bad-corpus.json');

async function readFileSafe(): Promise<CorpusFile> {
  try {
    const raw = await readFile(FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CorpusFile>;
    return { entries: Array.isArray(parsed.entries) ? parsed.entries as CorpusEntry[] : [] };
  } catch {
    return { entries: [] };
  }
}

async function writeFileSafe(data: CorpusFile): Promise<void> {
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    /* best-effort */
  }
}

function slugId(kind: CorpusKind, urlOrTitle: string): string {
  const base = urlOrTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48) || 'entry';
  return `${kind}_${base}_${Date.now().toString(36)}`;
}

export async function listCorpus(kind?: CorpusKind): Promise<CorpusEntry[]> {
  const data = await readFileSafe();
  return kind ? data.entries.filter((e) => e.kind === kind) : data.entries;
}

export async function addCorpusEntry(opts: {
  kind: CorpusKind;
  url?: string;
  title?: string;
  note?: string;
  industry?: string;
}): Promise<CorpusEntry> {
  if (opts.kind !== 'gold' && opts.kind !== 'bad') {
    throw new Error('kind must be gold|bad');
  }
  const data = await readFileSafe();
  const entry: CorpusEntry = {
    id: slugId(opts.kind, opts.url || opts.title || 'x'),
    kind: opts.kind,
    url: opts.url?.trim() || undefined,
    title: opts.title?.trim() || undefined,
    note: opts.note?.trim() || undefined,
    industry: opts.industry?.trim() || undefined,
    added_at: new Date().toISOString(),
  };
  data.entries.push(entry);
  data.entries = data.entries.slice(-200);
  await writeFileSafe(data);
  return entry;
}

export async function removeCorpusEntry(id: string): Promise<boolean> {
  const data = await readFileSafe();
  const before = data.entries.length;
  data.entries = data.entries.filter((e) => e.id !== id);
  if (data.entries.length === before) return false;
  await writeFileSafe(data);
  return true;
}
