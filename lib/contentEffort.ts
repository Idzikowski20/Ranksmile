/**
 * Content Effort signals — proxies for "hard to cheaply replicate", not AI detection.
 * Used by Content Score slots, Pre-Publish checklist, and domain portfolio insights.
 */
import { countOccurrences, tokenize, wordMatch } from './termMatch';

export type EffortSignalKey =
   | 'original_data'
   | 'custom_multimedia'
   | 'info_gain'
   | 'first_person'
   | 'lead_completeness';

export type EffortSignalStatus = 'pass' | 'warn' | 'fail' | 'unknown';

export type EffortChecklistItem = {
   key: EffortSignalKey;
   label: string;
   hint: string;
   status: EffortSignalStatus;
   detail: string;
};

export type ContentEffortInsight = {
   score: number;
   reasons: string[];
   source: 'heuristic' | 'llm';
   at?: string;
};

const FIRST_PERSON_RE =
   /\b(i|we|my|our|me|I've|we've|I'm|we're|ja|my|nasz[aey]?|mój|moja|moje|nasze|zauważyłem|zauważyłam|przetestowałem|przetestowałam|w praktyce|w naszym|u nas)\b/i;

const DATA_HINT_RE =
   /\b(\d{1,3}(?:[.,]\d+)?%|\d{2,}\s*(?:users?|klient|osób|respondent|ankiet|badań|badań|studies|survey|sample|n\s*=)|(?:nasze|our)\s+(?:dane|data|badanie|research|wyniki|results)|tabela|wykres|chart|table)\b/i;

const STOCK_ALT_RE = /^(image|photo|picture|img|zdjęcie|obraz|foto|screenshot|untitled|dsc_?\d+|img_?\d+)$/i;

const FIRST_HTML_BUDGET = 5500;

function stripTags(html: string): string {
   return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function plainWords(text: string): string[] {
   return text.split(/\s+/).filter(Boolean);
}

/** Keyword density / stuffing detector — high density of target phrase is spammy. */
export function keywordStuffingScore(plainText: string, keyword: string): { earned: number; max: number; density: number } {
   const max = 8;
   const kw = (keyword || '').trim();
   if (!kw || !plainText.trim()) return { earned: max, max, density: 0 };

   const words = plainWords(plainText);
   if (words.length < 40) return { earned: max, max, density: 0 };

   const occurrences = countOccurrences(plainText, kw);
   const kwToks = Math.max(tokenize(kw).length, 1);
   const density = (occurrences * kwToks) / words.length;

   // Natural ~0.5–2%; stuffing often >3–4% for multi-word or repeated single tokens
   if (density <= 0.025) return { earned: max, max, density };
   if (density <= 0.04) return { earned: 5, max, density };
   if (density <= 0.06) return { earned: 2, max, density };
   return { earned: 0, max, density };
}

/**
 * Early answer / lead quality — keyword + substantive answer in first screen (~100 words)
 * and within the first ~5.5k HTML chars (Peec Deep Research open budget).
 */
export function earlyAnswerScore(
   html: string,
   plainText: string,
   keyword: string,
): { earned: number; max: number } {
   const max = 10;
   const kw = (keyword || '').trim().toLowerCase();
   if (!plainText.trim()) return { earned: 0, max };

   const words = plainWords(plainText);
   const lead = words.slice(0, 120).join(' ');
   const leadLower = lead.toLowerCase();

   let score = 0;
   // Keyword / topic confirmation early
   if (kw) {
      const kwToks = tokenize(kw).filter((t) => t.length >= 3);
      const leadToks = tokenize(lead);
      const hits = kwToks.filter((q) => leadToks.some((t) => wordMatch(t, q))).length;
      if (kwToks.length && hits >= Math.min(kwToks.length, Math.max(1, Math.ceil(kwToks.length * 0.6)))) {
         score += 4;
      }
   } else {
      score += 2;
   }

   // Substantive lead (not just teaser): length + terminal punctuation / answer cues
   if (lead.length >= 180) score += 2;
   if (/[.!?]/.test(lead) && lead.length >= 80) score += 2;
   if (/\b(is|are|means|to|jest|to|oznacza|polega|how to|jak)\b/i.test(lead)) score += 1;

   // First HTML budget: content (not only nav) should appear in first ~5.5k chars
   if (html) {
      const head = html.slice(0, FIRST_HTML_BUDGET);
      const headText = stripTags(head);
      if (headText.length >= 400) score += 1;
      // Penalize if first budget is mostly nav/menu links with little prose
      const linkChars = (head.match(/<a\b/gi) || []).length;
      const proseWords = plainWords(headText).length;
      if (proseWords > 80 && linkChars < proseWords / 8) score += 0; // already ok
      else if (proseWords < 40 && linkChars > 8) score = Math.max(0, score - 2);
   }

   return { earned: Math.min(max, score), max };
}

/** Title–query: keyword early in title; soft length guidance (no hard 50–60 ranking). */
export function titleQueryScore(html: string, keyword: string, metaTitle?: string): number | null {
   const kw = (keyword || '').trim();
   if (!kw) return null;

   let title = (metaTitle || '').trim();
   if (!title) {
      const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html || '');
      if (!match) return null;
      title = match[1].replace(/<[^>]+>/g, '').trim();
   }
   if (!title) return null;

   const max = 7;
   let score = 0;
   const titleLower = title.toLowerCase();
   const kwLower = kw.toLowerCase();
   const kwToks = tokenize(kw).filter((t) => t.length >= 3);

   if (titleLower.includes(kwLower) || (kwToks.length && kwToks.every((q) => tokenize(title).some((t) => wordMatch(t, q))))) {
      score += 3;
      // Bonus when keyword appears in the first half of the title
      const idx = titleLower.indexOf(kwLower);
      if (idx >= 0 && idx <= Math.max(0, title.length * 0.45)) score += 2;
      else if (idx >= 0) score += 1;
      else {
         // token match only — still reward early token
         const firstTok = kwToks[0];
         if (firstTok) {
            const tIdx = titleLower.indexOf(firstTok);
            if (tIdx >= 0 && tIdx <= title.length * 0.5) score += 1;
         }
      }
   }

   // Soft length: readable SERP snippet, not a hard ranking band
   const len = title.length;
   if (len >= 30 && len <= 70) score += 2;
   else if (len >= 20 && len <= 90) score += 1;

   return Math.min(max, score);
}

/** Date consistency + author/bio presence (show effort to machines). */
export function datesAuthorScore(html: string, plainText: string): { earned: number; max: number } {
   const max = 6;
   let score = 0;
   const blob = `${html || ''}\n${plainText || ''}`;

   const hasAuthor =
      /itemprop=["']author["']/i.test(blob)
      || /rel=["']author["']/i.test(blob)
      || /\b(author|autor|napisane przez|written by|by\s+[A-ZÀ-Ö][\w.-]+)/i.test(blob)
      || /class=["'][^"']*author[^"']*["']/i.test(html || '');
   if (hasAuthor) score += 3;

   const hasBio =
      /\b(bio|o autorze|about the author|expertise|doświadczenie)\b/i.test(blob)
      || /itemprop=["']description["']/i.test(html || '');
   if (hasBio) score += 1;

   const dateMatches = blob.match(
      /\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]20\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|sty|lut|mar|kwi|maj|cze|lip|sie|wrz|paź|lis|gru)[a-z]*\s+\d{1,2},?\s+20\d{2})\b/gi,
   ) || [];
   const isoDates = blob.match(/datetime=["']([^"']+)["']/gi) || [];
   const dateCount = dateMatches.length + isoDates.length;
   if (dateCount >= 1) score += 1;
   if (dateCount >= 2) score += 1; // published + updated or consistent schema

   return { earned: Math.min(max, score), max };
}

/**
 * Thin originality / cheap-to-replicate proxy — short or highly repetitive / generic text.
 */
export function thinOriginalityScore(plainText: string): { earned: number; max: number } {
   const max = 8;
   const text = (plainText || '').trim();
   const words = plainWords(text);
   if (words.length === 0) return { earned: 0, max };

   // Very thin pages are easy to replicate
   if (words.length < 150) {
      const ratio = words.length / 150;
      return { earned: Math.round(ratio * 3), max };
   }

   const toks = tokenize(text).filter((t) => t.length >= 4);
   const unique = new Set(toks);
   const diversity = toks.length > 0 ? unique.size / toks.length : 0;

   // Bigram repetition
   let repeatedBigrams = 0;
   const bigrams = new Map<string, number>();
   for (let i = 0; i + 1 < toks.length; i += 1) {
      const bg = `${toks[i]} ${toks[i + 1]}`;
      const n = (bigrams.get(bg) || 0) + 1;
      bigrams.set(bg, n);
      if (n === 3) repeatedBigrams += 1;
   }

   let score = max;
   if (diversity < 0.35) score -= 4;
   else if (diversity < 0.45) score -= 2;
   if (repeatedBigrams >= 8) score -= 3;
   else if (repeatedBigrams >= 4) score -= 1;

   // Generic filler phrases
   const filler = (text.match(/\b(in today's|w dzisiejszych|it is important|ważne jest|in this article|w tym artykule|as we know|jak wiemy)\b/gi) || []).length;
   if (filler >= 4) score -= 2;
   else if (filler >= 2) score -= 1;

   // Reward original-data / first-person hints for mid+ length
   if (DATA_HINT_RE.test(text)) score = Math.min(max, score + 1);
   if (FIRST_PERSON_RE.test(text) && words.length >= 300) score = Math.min(max, score + 1);

   return { earned: Math.max(0, Math.min(max, score)), max };
}

/** AI extractability: density cues, descriptive alts, PAA terms findable in plain text. */
export function aiExtractabilityScore(
   html: string,
   plainText: string,
   paaQuestions?: string[],
): { earned: number; max: number } {
   const max = 8;
   let score = 0;
   const words = plainWords(plainText);
   if (words.length === 0) return { earned: 0, max };

   // Density: lists/tables/definitions beat wall of text
   const lists = (html.match(/<(ul|ol)\b/gi) || []).length;
   const tables = (html.match(/<table\b/gi) || []).length;
   const defs = (plainText.match(/\b(is|means|refers to|to|jest|oznacza|definiuje)\b/gi) || []).length;
   if (lists >= 1 || tables >= 1) score += 2;
   if (defs >= 2) score += 1;
   if (words.length >= 400 && words.length <= 2500) score += 1; // grounding-friendly budget
   else if (words.length > 2500) score += 0; // volume ≠ extractability

   // Descriptive alts as content channel
   const imgs = (html.match(/<img[^>]+>/gi) || []).filter((img) => !img.includes('data:'));
   if (imgs.length > 0) {
      let good = 0;
      for (const img of imgs) {
         const m = /alt=["']([^"']*)["']/i.exec(img);
         const alt = (m?.[1] || '').trim();
         if (alt.length >= 12 && !STOCK_ALT_RE.test(alt)) good += 1;
      }
      const ratio = good / imgs.length;
      if (ratio >= 0.7) score += 2;
      else if (ratio >= 0.3) score += 1;
   } else {
      score += 1; // no images → don't hard-fail extractability
   }

   // PAA / find terms in plain text
   if (paaQuestions?.length) {
      const body = plainText.toLowerCase();
      let hit = 0;
      for (const q of paaQuestions.slice(0, 8)) {
         const toks = q.toLowerCase().replace(/[?!.,]/g, '').split(/\s+/).filter((w) => w.length > 3);
         if (!toks.length) { hit += 1; continue; }
         if (toks.filter((w) => body.includes(w)).length / toks.length >= 0.55) hit += 1;
      }
      const ratio = hit / Math.min(paaQuestions.length, 8);
      if (ratio >= 0.7) score += 2;
      else if (ratio >= 0.4) score += 1;
   } else {
      score += 1;
   }

   return { earned: Math.min(max, score), max };
}

function infoGainStatus(paaCovered: number, paaTotal: number, entityCovered: number, entityTotal: number): EffortSignalStatus {
   if (paaTotal + entityTotal === 0) return 'unknown';
   const ratio = (paaCovered + entityCovered) / Math.max(paaTotal + entityTotal, 1);
   if (ratio >= 0.65) return 'pass';
   if (ratio >= 0.35) return 'warn';
   return 'fail';
}

/** Five effort signals for Pre-Publish / Write & Optimize checklist. */
export function buildEffortChecklist(input: {
   html?: string;
   plainText: string;
   keyword?: string;
   paaQuestions?: string[];
   /** Fraction of SERP/PAA/entity gaps covered — Unique vs SERP proxy. */
   uniqueVsSerp?: { covered: number; total: number };
}): EffortChecklistItem[] {
   const html = input.html || '';
   const plain = input.plainText || '';
   const words = plainWords(plain);
   const early = earlyAnswerScore(html, plain, input.keyword || '');
   const imgs = (html.match(/<img[^>]+>/gi) || []).filter((i) => !i.includes('data:'));
   let descriptiveAlts = 0;
   for (const img of imgs) {
      const m = /alt=["']([^"']*)["']/i.exec(img);
      const alt = (m?.[1] || '').trim();
      if (alt.length >= 12 && !STOCK_ALT_RE.test(alt)) descriptiveAlts += 1;
   }

   const hasData = DATA_HINT_RE.test(plain) || /<table\b/i.test(html);
   const hasExperience = FIRST_PERSON_RE.test(plain);
   const leadOk = early.earned >= 6;

   const uv = input.uniqueVsSerp;
   const gainStatus = uv
      ? infoGainStatus(uv.covered, uv.total, 0, 0)
      : (input.paaQuestions?.length
         ? (() => {
            const faq = aiExtractabilityScore(html, plain, input.paaQuestions);
            return faq.earned >= 6 ? 'pass' as const : faq.earned >= 3 ? 'warn' as const : 'fail' as const;
         })()
         : 'unknown' as const);

   return [
      {
         key: 'original_data',
         label: 'Original data / research',
         hint: 'Own numbers, tables, or study results — not generic claims',
         status: hasData ? 'pass' : words.length < 80 ? 'unknown' : 'fail',
         detail: hasData ? 'Found data/table cues' : 'Add original stats, a table, or research findings',
      },
      {
         key: 'custom_multimedia',
         label: 'Custom multimedia',
         hint: 'Images/diagrams with descriptive alts (alt is a content channel)',
         status: imgs.length === 0 ? 'warn' : descriptiveAlts / imgs.length >= 0.5 ? 'pass' : 'fail',
         detail: imgs.length === 0
            ? 'No images yet — add a diagram or annotated screenshot'
            : `${descriptiveAlts}/${imgs.length} images have descriptive alt text`,
      },
      {
         key: 'info_gain',
         label: 'Unique vs SERP',
         hint: 'Information gain: PAA / competitor gaps covered',
         status: gainStatus,
         detail: uv
            ? `${uv.covered}/${uv.total} unique SERP gaps covered`
            : gainStatus === 'unknown'
               ? 'Run deep analysis for SERP gap signals'
               : 'Cover more PAA / unique angles than competitors',
      },
      {
         key: 'first_person',
         label: 'Experience / first-person',
         hint: 'Lived experience or case language — not fake E-E-A-T',
         status: hasExperience ? 'pass' : words.length < 80 ? 'unknown' : 'warn',
         detail: hasExperience ? 'Found experience language' : 'Add a concrete case, test, or “we found…” detail',
      },
      {
         key: 'lead_completeness',
         label: 'Lead completeness',
         hint: 'Answer / confirm intent in the first screen (~5–6k HTML)',
         status: leadOk ? 'pass' : early.earned >= 3 ? 'warn' : 'fail',
         detail: leadOk ? 'Lead answers early' : 'Put a clear answer in the first ~100 words',
      },
   ];
}

/** Actionable Effort gaps for Auto-Optimize prompts (fail/warn only). */
export type EffortOptimizeGap = {
   key: string;
   instruction: string;
};

const EFFORT_EDIT_HINTS: Record<EffortSignalKey, string> = {
   original_data:
      'Add at least one original datum: a specific number, short research finding, or a simple <table> with real comparison values (not generic claims).',
   custom_multimedia:
      'If images exist, rewrite each alt to a descriptive sentence (≥12 chars) that carries meaning; if none, add a short diagram/screenshot with a useful alt.',
   info_gain:
      'Add unique angles vs typical SERP pages: cover uncovered PAA/competitor gaps with dedicated H2/H3 + short paragraphs.',
   first_person:
      'Add one concrete first-person / case detail (“we tested…”, “in practice we found…”) tied to a real observation — not fake credentials.',
   lead_completeness:
      'Rewrite the opening so the target query is answered clearly in the first ~100 words (and early in the HTML body, not after long nav/filler).',
};

/**
 * Build AO guidance lines from Effort checklist + score proxies.
 * Returns empty string when nothing actionable — callers can skip injection.
 */
export function buildEffortOptimizeGuidance(input: {
   html?: string;
   plainText: string;
   keyword?: string;
   paaQuestions?: string[];
   uniqueVsSerp?: { covered: number; total: number };
}): string {
   const html = input.html || '';
   const plain = input.plainText || '';
   const keyword = input.keyword || '';
   const gaps: EffortOptimizeGap[] = [];

   const checklist = buildEffortChecklist({
      html,
      plainText: plain,
      keyword,
      paaQuestions: input.paaQuestions,
      uniqueVsSerp: input.uniqueVsSerp,
   });
   for (const item of checklist) {
      if (item.status !== 'fail' && item.status !== 'warn') continue;
      gaps.push({
         key: item.key,
         instruction: `${item.label}: ${EFFORT_EDIT_HINTS[item.key]} (${item.detail})`,
      });
   }

   const stuffing = keywordStuffingScore(plain, keyword);
   if (keyword && stuffing.earned < stuffing.max / 2) {
      gaps.push({
         key: 'stuffing',
         instruction:
            `Keyword stuffing: reduce exact-match repeats of "${keyword}"; keep natural density and use synonyms/inflections instead of spam.`,
      });
   }

   const thin = thinOriginalityScore(plain);
   if (thin.earned < 4 && plainWords(plain).length >= 80) {
      gaps.push({
         key: 'originality',
         instruction:
            'Originality: replace template filler with specific, hard-to-replicate details (named examples, constraints, edge cases).',
      });
   }

   const datesAuthor = datesAuthorScore(html, plain);
   if (datesAuthor.earned < datesAuthor.max / 2) {
      gaps.push({
         key: 'dates_author',
         instruction:
            'Show effort to machines: add a clear author byline (and short bio if missing) plus an explicit publish/update date in the body or meta-visible markup.',
      });
   }

   const extract = aiExtractabilityScore(html, plain, input.paaQuestions);
   if (extract.earned < extract.max / 2) {
      gaps.push({
         key: 'ai_extract',
         instruction:
            'AI extractability: densify answers — use lists/tables, define key terms plainly, and make PAA answers findable in plain text (not only in images).',
      });
   }

   const unique = gaps.slice(0, 8);
   if (!unique.length) return '';

   return (
      'EFFORT (hard to cheaply replicate — NOT an AI detector):\n'
      + 'Improve these gaps surgically while keeping language and structure rules:\n'
      + unique.map((g) => `- ${g.instruction}`).join('\n')
   );
}

/** Heuristic 0–100 effort estimate when LLM is unavailable. */
export function heuristicContentEffort(input: {
   html?: string;
   plainText: string;
   keyword?: string;
   paaQuestions?: string[];
}): ContentEffortInsight {
   const checklist = buildEffortChecklist(input);
   const weights: Record<EffortSignalStatus, number> = { pass: 1, warn: 0.45, fail: 0, unknown: 0.35 };
   const avg = checklist.reduce((s, i) => s + weights[i.status], 0) / checklist.length;
   const stuffing = keywordStuffingScore(input.plainText, input.keyword || '');
   const thin = thinOriginalityScore(input.plainText);
   const extract = aiExtractabilityScore(input.html || '', input.plainText, input.paaQuestions);

   let score = Math.round(avg * 55 + (stuffing.earned / stuffing.max) * 15 + (thin.earned / thin.max) * 15 + (extract.earned / extract.max) * 15);
   score = Math.max(0, Math.min(100, score));

   const reasons: string[] = [];
   for (const item of checklist) {
      if (item.status === 'fail' || item.status === 'warn') reasons.push(item.detail);
   }
   if (stuffing.earned < stuffing.max / 2) reasons.push('Keyword density looks stuffed — ease off exact-match repeats');
   if (thin.earned < 4) reasons.push('Text looks thin or template-like — add unique specifics');
   while (reasons.length < 3 && checklist.some((c) => c.status === 'pass')) {
      const pass = checklist.find((c) => c.status === 'pass' && !reasons.includes(c.detail));
      if (!pass) break;
      reasons.push(`Strength: ${pass.detail}`);
   }

   return {
      score,
      reasons: reasons.slice(0, 3),
      source: 'heuristic',
      at: new Date().toISOString(),
   };
}

// ── Sprint 2: topical cohesion + portfolio pruning ───────────────────────────

export type TopicalCohesion = {
   /** 0–1 focus: share of ideas in the largest cluster (higher = tighter topical focus). */
   siteFocusScore: number;
   /** 0–1 radius proxy: how spread ideas are across clusters (higher = more diffuse). */
   siteRadius: number;
   clusterCount: number;
   dominantClusterShare: number;
};

/** siteFocus / siteRadius proxies from topic research clusters. */
export function computeTopicalCohesion(
   clusters: Array<{ ideas: unknown[]; volume?: number }>,
): TopicalCohesion {
   const clusterCount = clusters.length;
   if (clusterCount === 0) {
      return { siteFocusScore: 0, siteRadius: 0, clusterCount: 0, dominantClusterShare: 0 };
   }
   const sizes = clusters.map((c) => Math.max(c.ideas?.length || 0, 1));
   const total = sizes.reduce((s, n) => s + n, 0);
   const maxSize = Math.max(...sizes);
   const dominantClusterShare = maxSize / total;
   // Entropy-ish spread → radius
   let entropy = 0;
   for (const n of sizes) {
      const p = n / total;
      if (p > 0) entropy -= p * Math.log2(p);
   }
   const maxEntropy = Math.log2(clusterCount);
   const siteRadius = maxEntropy > 0 ? entropy / maxEntropy : 0;
   const siteFocusScore = Math.max(0, Math.min(1, dominantClusterShare * (1 - siteRadius * 0.5)));
   return { siteFocusScore, siteRadius, clusterCount, dominantClusterShare };
}

export type PruneCandidate = {
   id: number | string;
   title: string;
   url: string;
   content_score: number;
   clicks: number;
   impressions: number;
   reason: string;
   severity: 'high' | 'medium';
};

export type PortfolioQualityInsight = {
   articleCount: number;
   avgScore: number;
   scoreStdDev: number;
   lowQualityShare: number;
   recentBurstCount: number;
   pruneCandidates: PruneCandidate[];
   warning: string | null;
};

/** Domain portfolio: low-effort + no traffic = prune/rewrite candidates. */
export function computePortfolioPruning(
   rows: Array<{
      id: number | string;
      title: string;
      url: string;
      content_score: number;
      clicks: number;
      impressions: number;
      created_at?: string;
   }>,
   now = new Date(),
): PortfolioQualityInsight {
   const articleCount = rows.length;
   if (articleCount === 0) {
      return {
         articleCount: 0,
         avgScore: 0,
         scoreStdDev: 0,
         lowQualityShare: 0,
         recentBurstCount: 0,
         pruneCandidates: [],
         warning: null,
      };
   }

   const scores = rows.map((r) => r.content_score || 0);
   const avgScore = scores.reduce((s, n) => s + n, 0) / scores.length;
   const variance = scores.reduce((s, n) => s + (n - avgScore) ** 2, 0) / scores.length;
   const scoreStdDev = Math.sqrt(variance);
   const lowQualityShare = scores.filter((s) => s > 0 && s < 45).length / scores.length;

   const dayMs = 86400000;
   const recent = rows.filter((r) => {
      if (!r.created_at) return false;
      const t = new Date(r.created_at).getTime();
      return Number.isFinite(t) && now.getTime() - t <= 30 * dayMs;
   });
   const recentBurstCount = recent.length;
   const recentLow = recent.filter((r) => (r.content_score || 0) < 50).length;

   const pruneCandidates: PruneCandidate[] = [];
   for (const r of rows) {
      const score = r.content_score || 0;
      const clicks = r.clicks || 0;
      const impressions = r.impressions || 0;
      if (score > 0 && score < 40 && clicks <= 2 && impressions < 50) {
         pruneCandidates.push({
            id: r.id,
            title: r.title,
            url: r.url,
            content_score: score,
            clicks,
            impressions,
            reason: 'Low content score and near-zero traffic — prune or rewrite',
            severity: 'high',
         });
      } else if (score > 0 && score < 55 && clicks === 0 && impressions < 100) {
         pruneCandidates.push({
            id: r.id,
            title: r.title,
            url: r.url,
            content_score: score,
            clicks,
            impressions,
            reason: 'Mediocre effort signal with no clicks — rewrite candidate',
            severity: 'medium',
         });
      }
   }
   pruneCandidates.sort((a, b) => a.content_score - b.content_score);

   let warning: string | null = null;
   if (recentBurstCount >= 8 && recentLow / Math.max(recentBurstCount, 1) >= 0.5) {
      warning = `Publishing burst: ${recentBurstCount} pages in 30 days with many low scores — risk of scaled low-effort content`;
   } else if (lowQualityShare >= 0.4 && articleCount >= 5) {
      warning = `${Math.round(lowQualityShare * 100)}% of scored pages are below 45 — consider pruning the long tail`;
   } else if (scoreStdDev >= 25 && articleCount >= 8) {
      warning = 'Wide quality spread across the portfolio — focus on lifting or removing the bottom quartile';
   }

   return {
      articleCount,
      avgScore: Math.round(avgScore),
      scoreStdDev: Math.round(scoreStdDev * 10) / 10,
      lowQualityShare,
      recentBurstCount,
      pruneCandidates: pruneCandidates.slice(0, 25),
      warning,
   };
}
