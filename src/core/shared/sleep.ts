/** Await a delay. Shared — was hand-rolled in autopilot + dataforseoLlm. */
export const sleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });
