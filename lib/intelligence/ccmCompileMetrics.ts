/**
 * In-process CCM compile metrics (Etap 29). Ring buffer — no new deps/tables.
 */
export type CcmCompileOutcome = 'ok' | 'noop' | 'skipped' | 'error' | 'empty';

export type CcmCompileMetric = {
  readonly at: string;
  readonly articleId: number;
  readonly outcome: CcmCompileOutcome;
  readonly ms: number;
  readonly error?: string;
};

const MAX = 100;
const recent: CcmCompileMetric[] = [];
const totals: Record<CcmCompileOutcome, number> = {
  ok: 0,
  noop: 0,
  skipped: 0,
  error: 0,
  empty: 0,
};

export function recordCcmCompileMetric(m: Omit<CcmCompileMetric, 'at'> & { at?: string }): void {
  const row: CcmCompileMetric = {
    at: m.at ?? new Date().toISOString(),
    articleId: m.articleId,
    outcome: m.outcome,
    ms: m.ms,
    ...(m.error ? { error: m.error } : {}),
  };
  recent.push(row);
  if (recent.length > MAX) recent.shift();
  totals[row.outcome] += 1;
  console.info(
    `[ccm-metric] article=${row.articleId} outcome=${row.outcome} ms=${row.ms}` +
      (row.error ? ` err=${row.error}` : ''),
  );
}

export function getCcmCompileMetricsSummary(): {
  readonly totals: Readonly<Record<CcmCompileOutcome, number>>;
  readonly recent: readonly CcmCompileMetric[];
} {
  return { totals: { ...totals }, recent: [...recent] };
}

/** Test helper. */
export function resetCcmCompileMetrics(): void {
  recent.length = 0;
  (Object.keys(totals) as CcmCompileOutcome[]).forEach((k) => {
    totals[k] = 0;
  });
}
