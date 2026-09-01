/**
 * Eval history + trends / regression.
 */
import { mkdir, readFile, writeFile, appendFile } from 'fs/promises';
import path from 'path';

export type HistoryEntry = {
  runId: string;
  at: string;
  keyword: string;
  articleId?: number;
  writing_intelligence: number;
  seo: number;
  ai: number;
  beats_top5: 'wins' | 'ties' | 'loses' | 'unknown';
  dna_version?: number;
};

const ROOT = path.join(process.cwd(), 'data', 'wie-eval');
const HISTORY_FILE = path.join(ROOT, 'history.jsonl');
const TRENDS_FILE = path.join(ROOT, 'trends.md');

export async function appendHistory(entry: HistoryEntry): Promise<void> {
  await mkdir(ROOT, { recursive: true });
  await appendFile(HISTORY_FILE, `${JSON.stringify(entry)}\n`, 'utf-8');
}

export async function readHistory(limit = 100): Promise<HistoryEntry[]> {
  try {
    const raw = await readFile(HISTORY_FILE, 'utf-8');
    const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const out: HistoryEntry[] = [];
    for (const line of lines.slice(-limit)) {
      try {
        out.push(JSON.parse(line) as HistoryEntry);
      } catch {
        /* skip bad line */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export type TrendsResult = {
  markdown: string;
  regressions: string[];
};

export function buildTrendsMarkdown(
  history: HistoryEntry[],
  opts?: { keyword?: string; maxRuns?: number },
): TrendsResult {
  const maxRuns = opts?.maxRuns ?? 20;
  let rows = [...history];
  if (opts?.keyword) {
    const kw = opts.keyword.toLowerCase();
    rows = rows.filter((h) => h.keyword.toLowerCase() === kw);
  }
  rows = rows.slice(-maxRuns);
  const regressions: string[] = [];

  const lines = [
    '# WIE Eval Trends',
    '',
    opts?.keyword ? `Filter keyword: **${opts.keyword}**` : 'Scope: all keywords',
    '',
    '| Run | At | Keyword | WI | SEO | AI | vs Top5 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (let i = 0; i < rows.length; i += 1) {
    const h = rows[i];
    lines.push(
      `| ${h.runId.slice(0, 12)} | ${h.at.slice(0, 19)} | ${h.keyword.slice(0, 40)} | ${h.writing_intelligence} | ${h.seo} | ${h.ai} | ${h.beats_top5} |`,
    );
    if (i > 0) {
      const prev = rows[i - 1];
      const dWi = h.writing_intelligence - prev.writing_intelligence;
      if (dWi <= -5) {
        regressions.push(
          `${h.runId}: WI ${prev.writing_intelligence} → ${h.writing_intelligence} (Δ ${dWi.toFixed(1)})`,
        );
      }
      if (prev.beats_top5 === 'wins' && h.beats_top5 === 'loses') {
        regressions.push(`${h.runId}: beats_top5 flipped wins → loses`);
      }
    }
  }

  if (rows.length >= 2) {
    const first = rows[0];
    const last = rows[rows.length - 1];
    const spark = rows.map((r) => r.writing_intelligence.toFixed(0)).join(' → ');
    lines.push('', `## WI sparkline`, spark);
    lines.push(
      '',
      `Delta first→last: **${(last.writing_intelligence - first.writing_intelligence).toFixed(1)}**`,
    );
  }

  lines.push('', '## Regressions');
  if (regressions.length) {
    for (const r of regressions) lines.push(`- ${r}`);
  } else {
    lines.push('- none');
  }

  return { markdown: lines.join('\n'), regressions };
}

export async function writeTrendsFile(
  history?: HistoryEntry[],
  opts?: { keyword?: string },
): Promise<TrendsResult> {
  const h = history ?? await readHistory(50);
  const t = buildTrendsMarkdown(h, opts);
  await mkdir(ROOT, { recursive: true });
  await writeFile(TRENDS_FILE, t.markdown, 'utf-8');
  return t;
}

export function evalRootDir(): string {
  return ROOT;
}
