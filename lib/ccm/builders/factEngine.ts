/**
 * Fact Engine MVP (heuristic) — atomic statements + light SPO.
 * Not LLM/NER product; upgrades IR/builders without new RFC fields.
 */
const SENTENCE_SPLIT = /(?<=[.!?…])\s+(?=[„"A-ZĄĆĘŁŃÓŚŹŻ])/u;

/** Split block text into atomic claim surfaces (Surfer-like atoms). */
export function splitAtomicClaims(text: string): string[] {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return [];
  if (t.length < 40 || !/[.!?]/.test(t)) return [t];
  const parts = t.split(SENTENCE_SPLIT).map((s) => s.trim()).filter((s) => s.length >= 12);
  return parts.length ? parts : [t];
}

export type SpoTriple = {
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
};

const SPO_PATTERNS: Array<{
  re: RegExp;
  pred: string;
}> = [
  {
    re: /^(.{2,80}?)\s+(?:anektował[aoy]?|zajęł[aoy]|przejęł[aoy])\s+(.+)$/iu,
    pred: 'annexed',
  },
  {
    re: /^(.{2,80}?)\s+(?:użył[aoy]?|stosował[aoy]?|prowadził[aoy]?)\s+(.+)$/iu,
    pred: 'used',
  },
  {
    re: /^(.{2,60}?)\s+(?:to|jest|oznacza)\s+(.+)$/iu,
    pred: 'is',
  },
  {
    re: /^(.{2,80}?)\s+(?:wymaga|powoduje|obejmuje|łączy)\s+(.+)$/iu,
    pred: 'involves',
  },
];

export function parseSpoHeuristic(statement: string): SpoTriple | null {
  const s = statement.replace(/\s+/g, ' ').trim();
  for (const { re, pred } of SPO_PATTERNS) {
    const m = re.exec(s);
    if (!m) continue;
    const subject = (m[1] || '').trim();
    const object = (m[2] || '').replace(/[.!?…]+$/u, '').trim();
    if (subject.length < 2 || object.length < 2) continue;
    return { subject, predicate: pred, object };
  }
  return null;
}

export function normalizeFactKey(statement: string): string {
  return statement
    .toLocaleLowerCase('pl')
    .replace(/[„”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
