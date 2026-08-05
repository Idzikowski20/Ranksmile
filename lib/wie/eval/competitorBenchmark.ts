/**
 * Heuristic AO vs Top-N competitor benchmark (Opening / Narrative / Examples / EEAT / CTA).
 */
import { scoreEeat } from '../eeatScore';

export type BenchmarkFeature = 'opening' | 'narrative' | 'examples' | 'eeat' | 'cta';

export type CompetitorDoc = {
  label: string; // Top1, Top2, …
  title?: string;
  html?: string;
  plain?: string;
};

export type FeatureScores = Record<BenchmarkFeature, number>; // 0–10

export type BenchmarkRow = {
  label: string;
  scores: FeatureScores;
};

export type CompetitorBenchmarkResult = {
  partial: boolean;
  rows: BenchmarkRow[];
  winners: Record<BenchmarkFeature, string>;
  aoLabel: string;
};

const EXAMPLE_RE = /\b(np\.|na przykład|for example|Messenger|WhatsApp|Bitcoin|case)\b/i;
const EXPERT_RE = /w praktyce|najczęściej|z doświadczenia|in practice|typically|our team/i;
const PROBLEM_RE = /^(padł|ofiar|strach|nie wiesz|how to|what to do|jeśli|padłeś)/i;
const CTA_RE = /skontaktuj|umów|zadzwoń|napisz|skontaktuj się|contact us|book|call us|zgłoś się/i;
const YOU_RE = /\b(Ty|Tobie|Twój|you|your)\b/i;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function textOf(doc: CompetitorDoc): string {
  if (doc.plain) return doc.plain;
  if (doc.html) return stripTags(doc.html);
  return doc.title || '';
}

/** Score one document 0–10 per feature. */
export function scoreDocFeatures(doc: CompetitorDoc): FeatureScores {
  const plain = textOf(doc);
  const lead = plain.slice(0, 500);
  const words = plain.split(/\s+/).filter(Boolean).length;
  const eeat = scoreEeat(plain);

  let opening = 4;
  if (PROBLEM_RE.test(lead) || /padłeś ofiarą|nie jesteś sam|co robić/i.test(lead)) opening = 8;
  else if (/definicja|słownik|oznacza to/i.test(lead)) opening = 3;
  else if (YOU_RE.test(lead)) opening = 6;

  let narrative = 4;
  const h2 = (doc.html || '').match(/<h2\b/gi)?.length ?? 0;
  if (h2 >= 3 && words >= 800) narrative = 8;
  else if (h2 >= 2 && words >= 400) narrative = 6;
  else if (words < 200) narrative = 2;
  if (YOU_RE.test(plain)) narrative = Math.min(10, narrative + 1);

  let examples = 3;
  const exHits = (plain.match(EXAMPLE_RE) || []).length;
  examples = Math.min(10, 3 + exHits * 2);

  let eeatScore = Math.round(eeat.score / 10);
  eeatScore = Math.max(0, Math.min(10, eeatScore));

  let cta = CTA_RE.test(plain.slice(-1200)) ? 7 : CTA_RE.test(plain) ? 5 : 3;
  if (/może warto|rozważ/i.test(plain.slice(-800))) cta = Math.max(cta, 6);

  return {
    opening: Math.max(0, Math.min(10, opening)),
    narrative: Math.max(0, Math.min(10, narrative)),
    examples: Math.max(0, Math.min(10, examples)),
    eeat: eeatScore,
    cta: Math.max(0, Math.min(10, cta)),
  };
}

export function buildCompetitorBenchmark(opts: {
  aoHtml: string;
  aoTitle?: string;
  competitors: CompetitorDoc[];
}): CompetitorBenchmarkResult {
  const aoLabel = 'AO';
  const aoScores = scoreDocFeatures({
    label: aoLabel,
    html: opts.aoHtml,
    title: opts.aoTitle,
  });

  const rows: BenchmarkRow[] = [{ label: aoLabel, scores: aoScores }];
  let partial = false;

  opts.competitors.slice(0, 5).forEach((c, i) => {
    const label = c.label || `Top${i + 1}`;
    if (!c.html && !c.plain) partial = true;
    rows.push({
      label,
      scores: scoreDocFeatures({ ...c, label }),
    });
  });

  if (opts.competitors.length === 0) partial = true;

  const features: BenchmarkFeature[] = ['opening', 'narrative', 'examples', 'eeat', 'cta'];
  const winners = {} as Record<BenchmarkFeature, string>;
  for (const f of features) {
    // Deterministic argmax — ties break to first max (stable: AO preferred on equal)
    let best = rows[0];
    for (let i = 1; i < rows.length; i += 1) {
      const r = rows[i];
      if (r.scores[f] > best.scores[f]) best = r;
    }
    winners[f] = best.label;
  }

  return { partial, rows, winners, aoLabel };
}

export function formatBenchmarkMarkdown(b: CompetitorBenchmarkResult): string {
  const features: BenchmarkFeature[] = ['opening', 'narrative', 'examples', 'eeat', 'cta'];
  const header = ['Feature', ...b.rows.map((r) => r.label), 'Winner'].join(' | ');
  const sep = ['---', ...b.rows.map(() => '---'), '---'].join(' | ');
  const lines = [
    '## Comparison — AO vs Top5',
    b.partial ? '_Partial: some competitor bodies missing; scored from available text/meta._' : '',
    '',
    `| ${header} |`,
    `| ${sep} |`,
  ];
  for (const f of features) {
    const cells = b.rows.map((r) => String(r.scores[f]));
    lines.push(`| ${f} | ${cells.join(' | ')} | ${b.winners[f]} |`);
  }
  return lines.filter((l) => l !== undefined).join('\n');
}
