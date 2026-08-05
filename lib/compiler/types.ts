import type { ContentProfileId } from '../ccm/types/status';
import type { AstBlockType } from '../ccm/types/ast';
import type { CanonicalContentModel } from '../ccm/types/ccm';

/** Minimal TipTap-like doc — no @tiptap import required for skeleton. */
export type TipTapNode = {
  readonly type?: string;
  readonly text?: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly content?: readonly TipTapNode[];
};

export type CompileSource =
  | { readonly kind: 'plain'; readonly text: string }
  | { readonly kind: 'tiptap'; readonly doc: TipTapNode };

export type CompileOpts = {
  readonly articleId: string;
  /** REQUIRED ISO — caller supplies. No new Date() in compiler. */
  readonly compiledAt: string;
  readonly source: CompileSource;
  readonly profile?: ContentProfileId;
  readonly ccmId?: string;
  readonly version?: number;
  readonly locale?: string;
  readonly compilerId?: string;
  /** Default `full`. Incremental uses dirtyBlockIds + optional previous snapshot. */
  readonly mode?: 'full' | 'incremental';
  readonly dirtyBlockIds?: readonly string[];
  /** Prior snapshot for noop detection / invalidation (incremental). */
  readonly previous?: CanonicalContentModel;
};

export type LexTokenKind = 'heading' | 'paragraph' | 'list_item' | 'other';

export type LexToken = {
  readonly kind: LexTokenKind;
  readonly text: string;
  readonly headingLevel?: 1 | 2 | 3 | 4;
  /** Stable id assigned by lexer (b1, b2, …). */
  readonly blockId: string;
};

export type AstBlockTypeHint = AstBlockType;
