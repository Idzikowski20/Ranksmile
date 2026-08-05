/**
 * Load CCM for an article, apply live presence to current HTML, rebuild ActionGraph,
 * return AO EditCandidates. Non-fatal — empty array on miss/error.
 */
import type { EditCandidate } from '../ao/editCandidate';
import { ccmRecommendationsToEditCandidates } from './ccmToEditCandidates';
import { summarizeRecommendations } from './ccmRecommendations';

export type LoadCcmEditCandidatesOpts = {
  readonly articleId: number;
  readonly html: string;
  readonly limit?: number;
  readonly compiledAt?: string;
};

function htmlToPlain(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function loadCcmEditCandidatesForArticle(
  opts: LoadCcmEditCandidatesOpts,
): Promise<readonly EditCandidate[]> {
  try {
    const { ensureCcmTables } = await import('../ensureCcmTables');
    const { SqlCompileStore } = await import('./sqlCompileStore');
    const { applyLivePresence } = await import('./livePresence');
    const { buildActionGraph } = await import('../planner/actionGraphBuilder');

    await ensureCcmTables();
    const store = new SqlCompileStore();
    const model = await store.get(String(opts.articleId));
    if (!model) return [];

    const plain = htmlToPlain(opts.html);
    const live = applyLivePresence(model, plain);
    const builtAt = opts.compiledAt ?? model.compiledAt;
    const ag = buildActionGraph(live.model, { builtAt });
    const recs = summarizeRecommendations(ag, opts.limit ?? 8);
    return ccmRecommendationsToEditCandidates(recs, { limit: opts.limit ?? 8 });
  } catch {
    return [];
  }
}
