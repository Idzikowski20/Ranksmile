/**
 * Test mock for the `ai` SDK. The real package is pure ESM and pulls a large
 * provider dependency tree that Jest (CommonJS) can't load. The only export the
 * tool layer uses is `tool()`, which in the real SDK is an identity passthrough
 * (`function tool(t) { return t; }`) — so this mock is behavior-identical.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tool = (t: any) => t;
