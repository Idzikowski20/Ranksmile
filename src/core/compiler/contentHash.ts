import { createHash } from 'crypto';
import { canonicalJsonStringify } from '@/src/core/ccm/canonicalJson';
import type { CompileSource } from '@/src/core/compiler/types';

export function hashCompileSource(source: CompileSource): string {
  const payload =
    source.kind === 'plain'
      ? { kind: 'plain', text: source.text }
      : { kind: 'tiptap', doc: source.doc };
  return createHash('sha256').update(canonicalJsonStringify(payload)).digest('hex');
}
