import { CoverageItem, CoverageResult, CoverageSnapshot, computeCoverageScores } from './aiCoverage';
import { safeJsonParse } from './safeJson';
import { normalizeTerm } from './termUtils';

export interface CoverageSources {
  paa: CoverageItem[];
  intent: CoverageItem[];
  readability: CoverageItem[];
  entity: CoverageItem[];
}

/** Merge per-source CoverageItem arrays; dedupe by id (last wins), then by label (knowledge wins over intent). */
export function mergeCoverageItems(src: CoverageSources): CoverageItem[] {
  const all = [...src.paa, ...src.intent, ...src.readability, ...src.entity];
  const byId = new Map<string, CoverageItem>();
  for (const it of all) byId.set(it.id, it);

  const byLabel = new Map<string, CoverageItem>();
  for (const it of byId.values()) {
    const labelKey = normalizeTerm(it.label) || it.id;
    const prev = byLabel.get(labelKey);
    if (!prev) {
      byLabel.set(labelKey, it);
      continue;
    }
    const prevIsIntent = prev.type === 'intent' || prev.category === 'intent';
    const curIsIntent = it.type === 'intent' || it.category === 'intent';
    if (prevIsIntent && !curIsIntent) {
      byLabel.set(labelKey, it);
    } else if (!prevIsIntent && curIsIntent) {
      /* keep knowledge */
    } else if ((it.llmSources?.length ?? 0) > (prev.llmSources?.length ?? 0)) {
      byLabel.set(labelKey, it);
    } else if (it.quality > prev.quality) {
      byLabel.set(labelKey, it);
    }
  }

  return Array.from(byLabel.values());
}

/** THE ONLY place CoverageResult (the judge artifact) is consumed (4th-review layer boundary).
 *  Applies verdicts onto items → GRADED immutable items, derives the early flag, scores off the
 *  graded items, and wraps everything into a versioned snapshot. Nothing downstream sees CoverageResult. */
export function buildSnapshot(
  items: CoverageItem[],
  result: CoverageResult,
  meta: { judgeVersion: string; promptVersion: string; model: string; createdAt: string },
  topics?: CoverageSnapshot['topics'],
): CoverageSnapshot {
  const byId = new Map(result.items.map((vd) => [vd.id, vd]));
  const graded: readonly CoverageItem[] = items.map((it) => {
    const vd = byId.get(it.id);
    if (!vd) return it;
    return {
      ...it,
      covered: !!vd.covered,
      quality: vd.quality ?? it.quality,
      confidence: vd.confidence,
      needsExpansion: vd.needsExpansion ?? it.needsExpansion,
      missing: vd.missing ?? it.missing,
      reason: vd.reason ?? it.reason,
      sectionId: vd.sectionId ?? it.sectionId,
      provenance: { judgedBy: meta.model, judgedAt: meta.createdAt, promptVersion: meta.promptVersion },
    };
  });
  const early = result.answersMainQuestionEarly;
  const { overall, buckets } = computeCoverageScores(graded, early);   // graded items + boolean; no CoverageResult
  return {
    schemaVersion: 1,
    judgeVersion: meta.judgeVersion,
    promptVersion: meta.promptVersion,
    model: meta.model,
    createdAt: meta.createdAt,
    items: graded,
    buckets,
    answersMainQuestionEarly: early,
    overall,
    ...(topics?.length ? { topics } : {}),
  };
}

/** Parse a stored ai_info_to_cover value into a CoverageSnapshot, or null if absent/legacy/unknown schema.
 *  Handles both object input (Postgres JSONB) and JSON string input (SQLite TEXT). */
export function parseSnapshot(raw: unknown): CoverageSnapshot | null {
  // Handle string input (SQLite TEXT dialect): parse it first, then validate.
  let toValidate = raw;
  if (typeof raw === 'string') {
    toValidate = safeJsonParse(raw, null);
    if (toValidate === null) return null;
  }

  // Validate the object form.
  if (!toValidate || typeof toValidate !== 'object' || Array.isArray(toValidate)) return null;
  const snap = toValidate as Partial<CoverageSnapshot>;
  if (snap.schemaVersion !== 1 || !Array.isArray(snap.items) || !Array.isArray(snap.buckets)) return null;
  return snap as CoverageSnapshot;
}

/** Read just the items off a snapshot (or [] when absent). Convenience for UI that doesn't need buckets. */
export function parseCoverageItems(raw: unknown): readonly CoverageItem[] {
  const snap = parseSnapshot(raw);
  return snap ? snap.items : [];
}

/**
 * The questions the coverage judge will grade the article on, for the planner.
 *
 * These are what AI engines actually answer for the keyword (sources chat_gpt / gemini /
 * perplexity), and until now the planner never saw them — the article was written blind
 * to its own grading rubric, then scored 4/10 on questions no section was asked to
 * answer. Critical first, so the per-section `must answer` cap trims optional ones.
 */
export function coverageQuestionsForPlanner(raw: unknown): string[] {
  const rank: Record<string, number> = { critical: 0, recommended: 1, optional: 2 };
  const seen = new Set<string>();
  return parseCoverageItems(raw)
    .filter((i) => (i.category === 'knowledge' || i.category === 'intent') && i.label.trim())
    // `manual` is the CCM projection: compileAfterArticleChange reads articles.content,
    // extracts its facts and writes each one back as a knowledge item. Grading the
    // article against its own sentences is the point of that snapshot — feeding them to
    // the PLANNER is a loop. /generate pushes every one of these in as a claim, so each
    // run was partly sourced from the previous run's output; article 18 took four
    // "Wpleć frazy: ..." brief bullets in as facts that way, because at the time the
    // article body was the outline review document.
    //
    // What survives is external demand — llm / paa / serp / competitors — which is what
    // this list was added for.
    .filter((i) => i.source !== 'manual')
    .slice()
    // localeCompare after importance so two snapshots with the same items in a different
    // stored order yield the same order — the planner's per-section cap is otherwise
    // fed a row-order-dependent list.
    .sort((a, b) => (rank[a.importance] ?? 3) - (rank[b.importance] ?? 3)
      || a.label.localeCompare(b.label))
    .map((i) => i.label.trim())
    .filter((label) => {
      // normalizeTerm, not toLowerCase — the same key mergeCoverageItems dedupes on.
      // Lowercasing alone missed diacritic folding, NFD normalisation, whitespace
      // collapse and punctuation, so near-duplicate labels reached the planner.
      const key = normalizeTerm(label);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * The questions both planning routes feed the planner: the coverage judge's rubric
 * first, then any leftover PAA from score_data, deduped. One helper so `/content-plan`
 * and `/generate` cannot drift — they were maintaining the identical merge inline.
 */
export function mergedPlannerQuestions(aiInfoToCover: unknown, paaQuestions: unknown): string[] {
  const paa = Array.isArray(paaQuestions)
    ? paaQuestions.filter((q): q is string => typeof q === 'string')
    : [];
  return [...new Set([...coverageQuestionsForPlanner(aiInfoToCover), ...paa])];
}
