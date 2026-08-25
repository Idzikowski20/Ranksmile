/**
 * Test mock for `@ai-sdk/deepseek`. The real package is ESM-only and Jest (CJS)
 * can't load it. `createDeepSeek(opts)` returns a provider function that maps a
 * model id to a model instance; the guard/unit tests never invoke the model, so
 * a passthrough stub is behavior-equivalent for their purposes.
 */
export const createDeepSeek = (_opts?: unknown) => (modelId: string) => ({ modelId });
