import { createHash } from 'crypto';
import { canonicalJsonStringify } from '../ccm/canonicalJson';
import type { CompileSource } from './types';

export function hashCompileSource(source: CompileSource): string {
  const payload =
    source.kind === 'plain'
      ? { kind: 'plain', text: source.text }
      : { kind: 'tiptap', doc: source.doc };
  return createHash('sha256').update(canonicalJsonStringify(payload)).digest('hex');
}
