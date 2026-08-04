export type EmbeddingProvider = {
  readonly id: string;
  embed(text: string): number[] | Promise<number[]>;
};

/**
 * Token-bag hash (not char-bag): char hashes collapse Polish SEO sentences
 * into near-identical vectors and false-merge under CANONICALIZE_SIM_MIN.
 */
function tokenHashEmbed(text: string, dims = 256): number[] {
  const v = new Array(dims).fill(0);
  const tokens = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);

  const bump = (key: string, w: number) => {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = (h >>> 0) % dims;
    v[idx] += w;
    v[(idx * 7) % dims] += w * 0.5;
  };

  for (const tok of tokens) bump(tok, 1);
  for (let i = 0; i < tokens.length - 1; i++) {
    bump(`${tokens[i]}_${tokens[i + 1]}`, 0.75);
  }

  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / mag);
}

const hashProvider: EmbeddingProvider = {
  id: 'hash-v1',
  embed(text: string): number[] {
    return tokenHashEmbed(text);
  },
};

export function getEmbeddingProvider(): EmbeddingProvider {
  return hashProvider;
}
