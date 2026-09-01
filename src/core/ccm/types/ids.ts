/** Branded ID aliases — constructors live in lib/ccm/ids.ts (ADR-040). */
export type SubjectId = string & { readonly __brand: 'SubjectId' };
export type PredicateId = string & { readonly __brand: 'PredicateId' };
export type ObjectId = string & { readonly __brand: 'ObjectId' };
