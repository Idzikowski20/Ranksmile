/**
 * WIE EEAT score — Experience / Expertise / Authoritativeness / Trustworthiness.
 * Heuristic 0–100 composite (not a second LLM). Shared by Judge, RX, Quality Judge.
 */
export type EeatBreakdown = {
  experience: number;
  expertise: number;
  authoritativeness: number;
  trustworthiness: number;
  /** Weighted composite 0–100 */
  score: number;
  reasons: string[];
};

const EXPERIENCE_RE = /w praktyce|z doświadczenia|w naszej|nasze biuro|nasz zespół|obsłużyliśmy|in practice|from our|we have seen|handled \d+/i;
const EXPERTISE_RE = /najczęściej|zwykle|typowe|art\.|§|k\.k\.|ustaw|procedur|typically|usually|protocol|guideline/i;
const AUTHORITY_RE = /policja|prokuratur|sąd|ministerstw|WHO|GOV|NIST|RFC|oficjaln|urzęd|court|police|prosecutor/i;
const TRUST_RE = /nie gwarant|ryzyko|może się różnić|skonsultuj|disclaimer|źródło|according to|may vary|consult/i;
const FAKE_CRED_RE = /certyfikowany ekspert SEO z 20-letnim|najlepszy na świecie|gwarantujemy pozycję #1|100% skuteczności/i;
const EXAMPLE_RE = /\b(np\.|na przykład|for example|Messenger|WhatsApp|Bitcoin|case study)\b/i;
const YOU_RE = /\b(Ty|Tobie|Twój|Cię|you|your)\b/i;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Score EEAT dimensions from HTML (or plain text). */
export function scoreEeat(htmlOrPlain: string): EeatBreakdown {
  const plain = /</.test(htmlOrPlain) ? stripTags(htmlOrPlain) : htmlOrPlain;
  const words = plain.split(/\s+/).filter(Boolean).length;
  const reasons: string[] = [];

  let experience = 25;
  let expertise = 25;
  let authoritativeness = 25;
  let trustworthiness = 40;

  if (EXPERIENCE_RE.test(plain)) {
    experience += 35;
    reasons.push('experience_markers');
  }
  if (EXAMPLE_RE.test(plain)) {
    experience += 20;
    reasons.push('concrete_examples');
  }
  if (YOU_RE.test(plain)) {
    experience += 10;
    reasons.push('reader_addressed');
  }

  if (EXPERTISE_RE.test(plain)) {
    expertise += 35;
    reasons.push('expertise_markers');
  }
  if (words >= 120) {
    expertise += 15;
    reasons.push('depth');
  } else if (words < 40) {
    expertise -= 15;
    reasons.push('too_thin');
  }

  if (AUTHORITY_RE.test(plain)) {
    authoritativeness += 40;
    reasons.push('authority_refs');
  }
  const citeLike = (plain.match(/\b(20\d{2}|http|www\.|doi:)\b/gi) || []).length;
  if (citeLike >= 2) {
    authoritativeness += 15;
    reasons.push('citations_like');
  }

  if (TRUST_RE.test(plain)) {
    trustworthiness += 25;
    reasons.push('honest_limits');
  }
  if (FAKE_CRED_RE.test(plain)) {
    trustworthiness -= 50;
    experience -= 20;
    reasons.push('fake_credentials_penalty');
  }
  if (/\[Editor:|TODO:|lorem ipsum/i.test(plain)) {
    trustworthiness -= 40;
    reasons.push('placeholder');
  }

  experience = clamp(experience);
  expertise = clamp(expertise);
  authoritativeness = clamp(authoritativeness);
  trustworthiness = clamp(trustworthiness);

  // Experience & Trust weigh slightly higher for RX-style content
  const score = clamp(
    0.3 * experience + 0.25 * expertise + 0.2 * authoritativeness + 0.25 * trustworthiness,
  );

  return {
    experience,
    expertise,
    authoritativeness,
    trustworthiness,
    score,
    reasons,
  };
}

/** Soft floor for Writer/Judge accept when EEAT is the deciding signal. */
export const EEAT_SOFT_FLOOR = 45;
export const EEAT_STRONG_FLOOR = 60;
