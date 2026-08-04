export type CoverageStatus =
  | 'covered'
  | 'partial'
  | 'missing'
  | 'conflicting'
  | 'hallucinated'
  | 'outdated'
  | 'duplicate'
  | 'weak';

export type Importance = 'critical' | 'recommended' | 'optional';

export type FactVerification = 'verified' | 'asserted' | 'inferred' | 'rejected';

export type ContentProfileId =
  | 'blog'
  | 'landing'
  | 'medical'
  | 'news'
  | 'legal'
  | 'product'
  | 'saas'
  | 'travel'
  | 'finance'
  | 'generic';
