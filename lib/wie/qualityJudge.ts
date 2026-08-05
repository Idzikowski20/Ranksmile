import { scoreEeat } from './eeatScore';

/**
 * WIE Quality Judge — score curated/SERP articles before Pattern Discovery.
 * Heuristic 0–100; threshold for DNA influence defaults to 85.
 */
export type QualityJudgeResult = {
  score: number;
  reasons: string[];
  pass: boolean;
  signals: {
    wordCount: number;
    h2Count: number;
    problemFirst: boolean;
    hasExamples: boolean;
    hasExpertMarkers: boolean;
    paragraphCv: number;
    eeatScore: number;
  };
  eeat?: ReturnType<typeof scoreEeat>;
};

const DEFAULT_THRESHOLD = 85;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function paragraphCv(html: string): number {
  const ps = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
  const lens = ps.map((p) => stripTags(p).split(/\s+/).filter(Boolean).length).filter((n) => n > 12);
  if (lens.length < 3) return 0.25;
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  if (mean < 1) return 0.25;
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
  return Math.min(1.5, Math.sqrt(variance) / mean);
}

export function judgeArticleQuality(opts: {
  html: string;
  threshold?: number;
}): QualityJudgeResult {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const html = opts.html || '';
  const plain = stripTags(html);
  const words = plain.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const h2Count = (html.match(/<h2\b/gi) || []).length;
  const problemFirst = /^(padł|ofiar|strach|nie wiesz|how to|what to do|jeśli ktoś)/i.test(plain.slice(0, 400))
    || /padłeś ofiarą|nie jesteś sam|co robić/i.test(plain.slice(0, 800));
  const hasExamples = /\b(np\.|na przykład|for example|Messenger|WhatsApp|Bitcoin|case)\b/i.test(plain);
  const hasExpertMarkers = /w praktyce|najczęściej|z doświadczenia|in practice|typically|our team/i.test(plain);
  const cv = paragraphCv(html);

  const reasons: string[] = [];
  let score = 40;

  if (wordCount >= 600 && wordCount <= 5000) {
    score += 20;
    reasons.push('body_length_ok');
  } else if (wordCount >= 300) {
    score += 8;
    reasons.push('body_length_thin');
  } else {
    reasons.push('body_too_short');
  }

  if (h2Count >= 2) {
    score += 12;
    reasons.push('structure_h2');
  } else if (h2Count === 1) {
    score += 5;
  }

  if (hasExamples) {
    score += 12;
    reasons.push('has_examples');
  }
  if (hasExpertMarkers) {
    score += 10;
    reasons.push('expert_markers');
  }
  if (problemFirst) {
    score += 8;
    reasons.push('problem_first_signal');
  }
  if (cv >= 0.2) {
    score += 8;
    reasons.push('paragraph_variety');
  } else {
    reasons.push('uniform_paragraphs');
  }

  const eeat = scoreEeat(html);
  if (eeat.score >= 70) {
    score += 12;
    reasons.push('eeat_strong');
  } else if (eeat.score >= 50) {
    score += 6;
    reasons.push('eeat_ok');
  } else if (eeat.score < 40) {
    score -= 8;
    reasons.push('eeat_weak');
  }
  if (eeat.reasons.includes('fake_credentials_penalty')) {
    score -= 25;
    reasons.push('fake_credentials');
  }

  // Thin link-farm / stub
  const linkCount = (html.match(/<a\b/gi) || []).length;
  if (wordCount > 0 && linkCount / Math.max(1, wordCount / 50) > 8) {
    score -= 15;
    reasons.push('link_heavy');
  }

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    reasons,
    pass: score >= threshold,
    signals: {
      wordCount,
      h2Count,
      problemFirst,
      hasExamples,
      hasExpertMarkers,
      paragraphCv: cv,
      eeatScore: eeat.score,
    },
    eeat,
  };
}

export { DEFAULT_THRESHOLD as QUALITY_DNA_THRESHOLD };
