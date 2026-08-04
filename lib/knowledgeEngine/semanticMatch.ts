import { cosineSim } from '../semantic/embeddings';
import type { EmbeddingProvider } from './embeddingProvider';
import { getEmbeddingProvider } from './embeddingProvider';

/** Sole similarity entrypoint for Canonicalize + Coverage. */
export async function semanticMatchScore(
  a: string,
  b: string,
  provider: EmbeddingProvider = getEmbeddingProvider(),
): Promise<number> {
  const va = await Promise.resolve(provider.embed(a));
  const vb = await Promise.resolve(provider.embed(b));
  return cosineSim(va, vb);
}
