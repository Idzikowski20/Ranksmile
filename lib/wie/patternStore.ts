/**
 * WIE Pattern Store — file-backed (data/wie-pattern-store.json).
 * Stores patterns + effectiveness; not full article HTML.
 * DNA bumps snapshot prior state for rollback (data/wie-dna-snapshots.json).
 */
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { WRITING_PRINCIPLES } from './principles';

export type PatternLayer = 'global' | 'industry' | 'brand';

export type PatternConditions = {
  search_intent?: string[];
  industry?: string[];
  emotion?: string[];
  content_shape?: string[];
};

export type WritingPattern = {
  id: string;
  pattern: string;
  principle_id: string;
  reason: string;
  conditions: PatternConditions;
  layer: PatternLayer;
  industry?: string;
  weight: number;
  confidence: number;
  effectiveness: { used: number; success_rate: number };
  frequency: number;
  evidence: number;
  source: string;
  last_seen: string;
  dna_version: number;
};

export type PatternStoreSnapshot = {
  dna_version: number;
  patterns: WritingPattern[];
  updated_at: string;
  /** Audit trail for DNA bumps */
  version_notes?: string[];
};

export type DnaVersionMeta = {
  version: number;
  at: string;
  note: string;
};

type DnaSnapshotsFile = {
  /** Snapshots taken *before* bump — keyed by the version that was live */
  snapshots: Array<{
    version: number;
    at: string;
    note: string;
    store: PatternStoreSnapshot;
  }>;
};

const FILE = path.join(process.cwd(), 'data', 'wie-pattern-store.json');
const SNAPSHOTS_FILE = path.join(process.cwd(), 'data', 'wie-dna-snapshots.json');
const MAX_SNAPSHOTS = 12;

const SEED: WritingPattern[] = [
  {
    id: 'problem_before_definition',
    pattern: 'Problem before definition',
    principle_id: 'answer_user_problem_first',
    reason: 'Highest engagement for high-emotion informational articles',
    conditions: {
      search_intent: ['informational'],
      industry: ['Legal', 'Health', 'Finance'],
      emotion: ['high'],
    },
    layer: 'industry',
    industry: 'Legal',
    weight: 0.94,
    confidence: 0.92,
    effectiveness: { used: 0, success_rate: 0.5 },
    frequency: 1,
    evidence: 1,
    source: 'seed',
    last_seen: new Date().toISOString().slice(0, 10),
    dna_version: 1,
  },
  {
    id: 'definition_first_technical',
    pattern: 'Definition first',
    principle_id: 'answer_user_problem_first',
    reason: 'Technical canonical queries expect precise definition then explanation',
    conditions: {
      search_intent: ['informational'],
      industry: ['SeoSaas', 'Developer'],
      emotion: ['low'],
      content_shape: ['technical_canonical'],
    },
    layer: 'industry',
    industry: 'SeoSaas',
    weight: 0.9,
    confidence: 0.88,
    effectiveness: { used: 0, success_rate: 0.5 },
    frequency: 1,
    evidence: 1,
    source: 'seed',
    last_seen: new Date().toISOString().slice(0, 10),
    dna_version: 1,
  },
  {
    id: 'one_example_per_practical',
    pattern: 'One concrete example in practical sections',
    principle_id: 'concrete_over_abstract',
    reason: 'Examples raise trust and information gain',
    conditions: {
      search_intent: ['informational'],
      emotion: ['high', 'medium', 'low'],
    },
    layer: 'global',
    weight: 0.95,
    confidence: 0.93,
    effectiveness: { used: 0, success_rate: 0.5 },
    frequency: 1,
    evidence: 1,
    source: 'seed',
    last_seen: new Date().toISOString().slice(0, 10),
    dna_version: 1,
  },
  {
    id: 'expert_markers',
    pattern: 'Expert voice markers (w praktyce / najczęściej)',
    principle_id: 'concrete_over_abstract',
    reason: 'EEAT signal without inventing credentials',
    conditions: {
      industry: ['Legal', 'Health', 'Finance', 'Agency'],
      emotion: ['high', 'medium'],
    },
    layer: 'industry',
    industry: 'Legal',
    weight: 0.88,
    confidence: 0.85,
    effectiveness: { used: 0, success_rate: 0.5 },
    frequency: 1,
    evidence: 1,
    source: 'seed',
    last_seen: new Date().toISOString().slice(0, 10),
    dna_version: 1,
  },
];

function emptyStore(): PatternStoreSnapshot {
  return {
    dna_version: 1,
    patterns: SEED.map((p) => ({ ...p, effectiveness: { ...p.effectiveness } })),
    updated_at: new Date().toISOString(),
    version_notes: [],
  };
}

function cloneStore(store: PatternStoreSnapshot): PatternStoreSnapshot {
  return JSON.parse(JSON.stringify(store)) as PatternStoreSnapshot;
}

async function readSnapshotsFile(): Promise<DnaSnapshotsFile> {
  try {
    const raw = await readFile(SNAPSHOTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DnaSnapshotsFile>;
    return { snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [] };
  } catch {
    return { snapshots: [] };
  }
}

async function writeSnapshotsFile(data: DnaSnapshotsFile): Promise<void> {
  try {
    await mkdir(path.dirname(SNAPSHOTS_FILE), { recursive: true });
    await writeFile(SNAPSHOTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    /* best-effort */
  }
}

export async function readPatternStore(): Promise<PatternStoreSnapshot> {
  try {
    const raw = await readFile(FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PatternStoreSnapshot>;
    if (!Array.isArray(parsed.patterns) || !parsed.patterns.length) return emptyStore();
    return {
      dna_version: typeof parsed.dna_version === 'number' ? parsed.dna_version : 1,
      patterns: parsed.patterns as WritingPattern[],
      updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : new Date().toISOString(),
      version_notes: Array.isArray(parsed.version_notes) ? parsed.version_notes : [],
    };
  } catch {
    return emptyStore();
  }
}

export async function writePatternStore(store: PatternStoreSnapshot): Promise<void> {
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(
      FILE,
      JSON.stringify({ ...store, updated_at: new Date().toISOString() }, null, 2),
      'utf-8',
    );
  } catch {
    // best-effort
  }
}

/** confidence decays ~0.03 per 90 days without last_seen refresh (simple linear). */
export function applyConfidenceDecay(p: WritingPattern, now = new Date()): number {
  const last = Date.parse(p.last_seen);
  if (!Number.isFinite(last)) return p.confidence;
  const days = Math.max(0, (now.getTime() - last) / (86400 * 1000));
  const decay = Math.min(0.4, (days / 90) * 0.03);
  return Math.max(0.2, p.confidence - decay);
}

/**
 * Persist decayed confidence into the store (run from Policy resolve / cron).
 * Caps work: only rewrite when any pattern drops by ≥0.01.
 */
export async function persistConfidenceDecay(now = new Date()): Promise<{ updated: number }> {
  const store = await readPatternStore();
  let updated = 0;
  for (const p of store.patterns) {
    const next = applyConfidenceDecay(p, now);
    if (p.confidence - next >= 0.01) {
      p.confidence = Math.round(next * 1000) / 1000;
      updated += 1;
    }
  }
  if (updated > 0) await writePatternStore(store);
  return { updated };
}

/**
 * Score pattern for context. Prefer effectiveness over raw confidence when used>=5.
 */
export function scorePatternForContext(
  p: WritingPattern,
  ctx: { industry: string; emotion: string; searchIntent: string; contentShape?: string },
): number | null {
  const c = p.conditions;
  if (c.search_intent?.length && !c.search_intent.includes(ctx.searchIntent)) return null;
  if (c.emotion?.length && !c.emotion.includes(ctx.emotion)) return null;
  if (c.industry?.length && !c.industry.includes(ctx.industry) && p.layer !== 'global') return null;
  if (c.content_shape?.length && ctx.contentShape && !c.content_shape.includes(ctx.contentShape)) {
    return null;
  }

  const conf = applyConfidenceDecay(p);
  const base = p.effectiveness.used >= 5
    ? 0.35 * conf + 0.65 * p.effectiveness.success_rate
    : conf;

  const layerMul = p.layer === 'brand' ? 1.0 : p.layer === 'industry' ? 0.95 : 0.85;
  return base * p.weight * layerMul * (WRITING_PRINCIPLES.some((pr) => pr.id === p.principle_id) ? 1 : 0.5);
}

export async function recordPatternOutcome(opts: {
  patternIds: string[];
  success: boolean;
}): Promise<void> {
  if (!opts.patternIds.length) return;
  const store = await readPatternStore();
  const ids = new Set(opts.patternIds);
  let changed = false;
  for (const p of store.patterns) {
    if (!ids.has(p.id)) continue;
    const used = p.effectiveness.used + 1;
    const prevSuccesses = p.effectiveness.success_rate * p.effectiveness.used;
    const successes = prevSuccesses + (opts.success ? 1 : 0);
    p.effectiveness = { used, success_rate: successes / used };
    p.last_seen = new Date().toISOString().slice(0, 10);
    p.frequency += 1;
    changed = true;
  }
  if (changed) await writePatternStore(store);
}

/** List prior DNA versions available for rollback (newest first). */
export async function listDnaVersions(): Promise<{
  current: number;
  versions: DnaVersionMeta[];
}> {
  const store = await readPatternStore();
  const file = await readSnapshotsFile();
  const versions = file.snapshots
    .map((s) => ({ version: s.version, at: s.at, note: s.note }))
    .sort((a, b) => b.version - a.version);
  return { current: store.dna_version, versions };
}

/**
 * Bump DNA version: snapshot current store, then increment + note.
 */
export async function bumpDnaVersion(note: string): Promise<PatternStoreSnapshot> {
  const store = await readPatternStore();
  const snapFile = await readSnapshotsFile();
  snapFile.snapshots.push({
    version: store.dna_version,
    at: new Date().toISOString(),
    note: note || 'bump',
    store: cloneStore(store),
  });
  snapFile.snapshots = snapFile.snapshots.slice(-MAX_SNAPSHOTS);
  await writeSnapshotsFile(snapFile);

  store.dna_version = (store.dna_version || 1) + 1;
  const notes = Array.isArray(store.version_notes) ? store.version_notes : [];
  notes.push(`${store.dna_version}:${new Date().toISOString()}:${note}`);
  store.version_notes = notes.slice(-20);
  for (const p of store.patterns) {
    if (p.layer === 'brand' || p.source.startsWith('brand:')) {
      p.dna_version = store.dna_version;
    }
  }
  await writePatternStore(store);
  return store;
}

/**
 * Restore Pattern Store to a previously snapshotted DNA version.
 * Snapshots the current live store first so rollback itself is reversible.
 */
export async function rollbackDnaVersion(targetVersion: number): Promise<PatternStoreSnapshot> {
  const snapFile = await readSnapshotsFile();
  const matches = snapFile.snapshots.filter((s) => s.version === targetVersion);
  const hit = matches[matches.length - 1];
  if (!hit) {
    throw new Error(`dna_version_${targetVersion}_not_found`);
  }

  const current = await readPatternStore();
  snapFile.snapshots.push({
    version: current.dna_version,
    at: new Date().toISOString(),
    note: `pre_rollback_to_${targetVersion}`,
    store: cloneStore(current),
  });
  snapFile.snapshots = snapFile.snapshots.slice(-MAX_SNAPSHOTS);
  await writeSnapshotsFile(snapFile);

  const restored = cloneStore(hit.store);
  const notes = Array.isArray(restored.version_notes) ? restored.version_notes : [];
  notes.push(`${restored.dna_version}:${new Date().toISOString()}:rollback_restore`);
  restored.version_notes = notes.slice(-20);
  restored.updated_at = new Date().toISOString();
  await writePatternStore(restored);
  return restored;
}

export { SEED as SEED_PATTERNS };
