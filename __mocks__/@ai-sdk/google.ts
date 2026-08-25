/**
 * Test mock for `@ai-sdk/google` — ESM-only, unloadable under Jest (CJS). See the
 * deepseek mock: `createGoogleGenerativeAI(opts)` returns a model-getter stub.
 */
export const createGoogleGenerativeAI = (_opts?: unknown) => (modelId: string) => ({ modelId });
