/**
 * First-class AO run metrics + outcome classification.
 * Separates "score went up" from "AO did the intended class of work".
 */

export type AoRunOutcomeKind =
  | 'fully_optimized'
  | 'partial_body'
  | 'faq_only'
  | 'incomplete_no_body'
  | 'no_change'
  | 'already_optimal'
  | 'rolled_back';

export function resolveAoWorkOutcome(opts: {
  bodyAccepted: number;
  faqAccepted: boolean;
  seoEntityGapsBefore: number;
  seoEntityGapsAfter: number;
  rolledBack?: boolean;
  alreadyOptimal?: boolean;
}): AoRunOutcomeKind {
  if (opts.rolledBack) return 'rolled_back';
  if (opts.alreadyOptimal) return 'already_optimal';

  const bodyOk = opts.bodyAccepted > 0;
  const faqOk = opts.faqAccepted;
  const seoImproved = opts.seoEntityGapsAfter < opts.seoEntityGapsBefore;

  if (!bodyOk && !faqOk) return 'no_change';

  // Body untouched + FAQ carried the run while SEO gaps remain → not a full success
  if (!bodyOk && faqOk && opts.seoEntityGapsAfter > 0 && !seoImproved) {
    return 'faq_only';
  }

  if (!bodyOk && faqOk) return 'faq_only';

  if (bodyOk && (seoImproved || opts.seoEntityGapsAfter === 0)) {
    return faqOk ? 'fully_optimized' : 'partial_body';
  }

  if (bodyOk) return 'partial_body';

  return 'incomplete_no_body';
}

export function aoOutcomeUserMessage(outcome: AoRunOutcomeKind): string {
  switch (outcome) {
    case 'fully_optimized':
      return 'Article optimized. Review changes, then Save to apply';
    case 'partial_body':
      return 'Partial optimization — review body edits, then Save. Some gaps may remain.';
    case 'faq_only':
      return 'Optimization incomplete — no existing sections were improved; only FAQ coverage changed.';
    case 'incomplete_no_body':
      return 'Optimization incomplete — no existing article sections were successfully improved.';
    case 'already_optimal':
      return 'Already optimized.';
    case 'rolled_back':
      return 'Changes were rolled back to keep quality stable.';
    case 'no_change':
    default:
      return 'No usable improvements this time.';
  }
}
