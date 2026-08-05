# 05 — Aggregator & Content Profiles

## Rule

**No single hardcoded weight vector for the product.**

Weights come from a **Content Profile**. The former foundation `0.30/0.20/…` becomes the **default `blog` profile**, not global law.

## Profile registry

```ts
export interface ContentScoreProfile {
  readonly id: ContentProfileId;
  readonly weights: Readonly<Record<ScoreComponentKey, number>>; // sum ≈ 1
  readonly statusPolicy: StatusPolicy;
  readonly freshnessDays?: number; // for outdated detection
}

export type ScoreComponentKey =
  | 'fact'
  | 'intent'
  | 'entity'
  | 'question'
  | 'evidence_link'   // % facts with supportedBy — not orphan evidence nodes
  | 'structure'
  | 'topic'
  | 'trust'           // citations / verification rate (optional per profile)
  | 'freshness';
```

### Default profiles (v1 seeds)

| Profile | Emphasize |
|---------|-----------|
| blog | fact, intent, structure |
| news | freshness, fact, entity |
| medical | trust, evidence_link, fact, entity |
| legal | trust, evidence_link, conflicting penalties |
| landing | intent, structure, question |
| product / saas | intent, entity, question |
| travel / finance | fact, entity, freshness, trust |
| generic | balanced blog-like |

Exact numeric tables are **data**, versioned in `lib/ckb/profiles/*.ts` after RFC accept — not magic numbers in Aggregator code paths beyond profile load.

### Blog default (illustrative)

```ts
export const PROFILE_BLOG: ContentScoreProfile = {
  id: 'blog',
  weights: {
    fact: 0.28,
    intent: 0.18,
    entity: 0.12,
    question: 0.10,
    evidence_link: 0.12,
    structure: 0.10,
    topic: 0.05,
    trust: 0.03,
    freshness: 0.02,
  },
  statusPolicy: DEFAULT_STATUS_POLICY,
};
```

## Status → credit

```ts
export interface StatusPolicy {
  readonly credit: Readonly<Record<CoverageStatus, number>>; // usually 0..1
}

export const DEFAULT_STATUS_POLICY: StatusPolicy = {
  credit: {
    covered: 1,
    partial: 0.5,
    weak: 0.35,
    missing: 0,
    conflicting: 0,
    hallucinated: 0,
    outdated: 0.25,
    duplicate: 0, // scored once via primary fact
  },
};
```

Conflicting/hallucinated also emit Judge-facing flags independent of score.

## Aggregation algorithm

1. Select profile from article/domain settings (fallback `generic`).  
2. For each component, importance-weighted average of node credits (see graph kind mapping).  
3. `evidence_link` = importance-weighted fraction of Facts with ≥1 `supportedBy`.  
4. `overall = round(sum(weight_i * score_i))` clamp 0..100.  
5. Attach `explain[]` via ReasoningIndex seeds (top missing paths).

## SEO score

`scoreArticleHtml` remains **orthogonal**. UI may show SEO + ContentScore + AI Visibility projection. Do not blend into one mystery number without an explicit “Writing Intelligence” formula (future consumer).
