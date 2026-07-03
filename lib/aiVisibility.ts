/** Shared AI Visibility types + constants (client + server). Persistence lives
 * in the DB (lib/ensureAiVisibilityTables.ts) — the earlier localStorage mock is gone. */

export type AiVisPrompt = { id: number, text: string, provenance: string[], selected: boolean };
export type AiVisTopic = { title: string, prompts: AiVisPrompt[] };
export type AiVisConfig = {
   id: number,
   brandName: string,
   promptLimit: number,
   models: string[],
   completedAt: string | null,
   topics: AiVisTopic[],
};

/** The five AI engines we track (the "Big 5"). Filtered against on every read of
 * ai_vis_configs.models so a corrupt row can never reach the scan runner.
 * chat_gpt/perplexity/gemini use DFS llm_responses; ai_overview/ai_mode use
 * DFS Google SERP endpoints — routing lives in lib/dataforseoLlm.ts. */
export const AI_VIS_ALL_MODELS = ['ai_overview', 'ai_mode', 'chat_gpt', 'perplexity', 'gemini'] as const;
export const AI_VIS_DEFAULT_MODELS: string[] = [...AI_VIS_ALL_MODELS];
export const AI_VIS_MODEL_LABEL: Record<string, string> = {
   ai_overview: 'AI Overviews', ai_mode: 'AI Mode', chat_gpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini',
};
export const AI_VIS_PROMPT_LIMIT = 50;

// Runner tuning — single source of truth so scan concurrency, the budget backstop,
// and the stale-scan heartbeat are not duplicated across modules.
export const AI_VIS_CONCURRENCY = 3;
export const AI_VIS_HARD_CAP_PAIRS = 250; // 50 prompts × 5 models — budget backstop
export const AI_VIS_SCAN_STALE_MS = 10 * 60 * 1000; // a `running` scan older than this is dead

/** Cyclic-tracking tunables — one home so cadence, cooldown, scheduler tick, and
 *  batch size are all findable together. SCHEDULER_TICK_HOURS is mirrored in
 *  python-sidecar/pipeline/ai_vis_scheduler.py (Python can't import TS). */
export const AI_VIS_SETTINGS = {
   REFRESH_INTERVAL_DAYS: 14,       // auto re-scan cadence, measured from finished_at
   MANUAL_REFRESH_COOLDOWN_DAYS: 7, // below this a manual scan asks for confirmation
   SCHEDULER_TICK_HOURS: 6,         // sidecar scheduler tick
   SCHEDULER_BATCH_LIMIT: 5,        // max scans enqueued per due-scans tick (oldest first)
} as const;

/** Keep only recognised model ids (used by both config save and the scan runner). */
export function sanitizeModels(models: unknown): string[] {
   const all = AI_VIS_ALL_MODELS as readonly string[];
   const list = Array.isArray(models) ? models.filter((m): m is string => typeof m === 'string' && all.includes(m)) : [];
   return list.length ? list : AI_VIS_DEFAULT_MODELS;
}

export function countSelected(topics: AiVisTopic[]): number {
   return topics.reduce((n, t) => n + t.prompts.filter((p) => p.selected).length, 0);
}
