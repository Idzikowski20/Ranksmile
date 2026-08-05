export type AstBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'list_item'
  | 'blockquote'
  | 'table'
  | 'code'
  | 'image'
  | 'other';

export interface AstBlock {
  readonly blockId: string;
  readonly type: AstBlockType;
  readonly headingLevel?: 1 | 2 | 3 | 4;
  readonly text: string;
  readonly marks?: readonly string[];
  readonly children?: readonly string[];
  readonly parentId?: string;
}

export interface LexicalAst {
  readonly version: 1;
  readonly blocks: readonly AstBlock[];
}

export type DiscourseRole =
  | 'definition'
  | 'example'
  | 'consequence'
  | 'summary'
  | 'faq'
  | 'other';

export interface ClaimCandidate {
  readonly id: string;
  readonly blockId: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly text: string;
  readonly kind: 'factish' | 'definition' | 'opinion' | 'other';
}

export interface DiscourseSpan {
  readonly blockId: string;
  readonly role: DiscourseRole;
}

export interface SemanticAst {
  readonly version: 1;
  readonly claims: readonly ClaimCandidate[];
  readonly discourse: readonly DiscourseSpan[];
}
