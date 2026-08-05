import { languageInstructionForLlm } from '../domainLanguagePrompts';
import { normalizeTerm } from '../termUtils';
import { safeJsonParse } from '../safeJson';
import { chatLlm } from '../ai/deepseek';
import type { TopicBucket } from './clusterQuestions';
import { PLACEHOLDER_TOPIC_ID, PLACEHOLDER_TOPIC_TITLE, tokenizeForHarvest } from './clusterQuestions';
import { MIN_TOPICS, medianQuestionCount } from './enforceBudget';
import type { HarvestedQuestion } from './canonicalizeQuestion';

export type FillResult = {
  topics: TopicBucket[];
  llmAddedTopics: number;
};

function needsFill(topics: TopicBucket[]): boolean {
  if (topics.length < MIN_TOPICS) return true;
  return medianQuestionCount(topics) < 3;
}

function parseTitles(raw: string): string[] {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const parsed = safeJsonParse<unknown>(cleaned, null);
  if (!Array.isArray(parsed)) return [];
  const out: string[] = [];
  for (const row of parsed) {
    if (typeof row === 'string') {
      const t = row.replace(/\s+/g, ' ').trim();
      if (t.length >= 8 && t.length <= 80) out.push(t);
      continue;
    }
    if (row && typeof row === 'object' && typeof (row as { title?: unknown }).title === 'string') {
      const t = String((row as { title: string }).title).replace(/\s+/g, ' ').trim();
      if (t.length >= 8 && t.length <= 80) out.push(t);
    }
  }
  return [...new Set(out)].slice(0, 12);
}

function reclusterIntoTitles(
  titles: string[],
  questions: Array<HarvestedQuestion & { confidence?: number }>,
): TopicBucket[] {
  const buckets = new Map<string, TopicBucket>();
  for (const title of titles) {
    const id = `topic-${normalizeTerm(title).slice(0, 48)}`;
    buckets.set(id, { id, title, questions: [] });
  }
  buckets.set(PLACEHOLDER_TOPIC_ID, {
    id: PLACEHOLDER_TOPIC_ID,
    title: PLACEHOLDER_TOPIC_TITLE,
    questions: [],
  });

  for (const q of questions) {
    const qTokens = new Set(tokenizeForHarvest(q.question));
    let bestId = PLACEHOLDER_TOPIC_ID;
    let bestShared = 0;
    for (const title of titles) {
      const id = `topic-${normalizeTerm(title).slice(0, 48)}`;
      const shared = tokenizeForHarvest(title).filter((t) => qTokens.has(t)).length;
      if (shared > bestShared) {
        bestShared = shared;
        bestId = id;
      }
    }
    const bucket = buckets.get(bestId) || buckets.get(PLACEHOLDER_TOPIC_ID)!;
    bucket.questions.push({
      ...q,
      confidence: q.confidence ?? (bestShared >= 2 ? 0.5 : 0.1),
    });
  }

  return [...buckets.values()].filter((b) => b.questions.length > 0);
}

/**
 * When topics are thin (count < 6 OR median qs < 3) and we have enough unique questions,
 * ask DeepSeek for topic titles and redistribute.
 */
export async function fillMissingTopics(opts: {
  keyword: string;
  languageCode?: string;
  topics: TopicBucket[];
  uniqueQuestions: number;
}): Promise<FillResult> {
  const { topics, uniqueQuestions, keyword } = opts;
  if (!needsFill(topics) || uniqueQuestions < 9) {
    return { topics, llmAddedTopics: 0 };
  }
  if (!chatLlm().apiKey) {
    return { topics, llmAddedTopics: 0 };
  }

  const existingTitles = topics
    .filter((t) => t.id !== PLACEHOLDER_TOPIC_ID)
    .map((t) => t.title);
  const sampleQs = topics
    .flatMap((t) => t.questions.map((q) => q.question))
    .slice(0, 24);
  const need = Math.max(0, MIN_TOPICS - existingTitles.length);
  const langHint = languageInstructionForLlm(opts.languageCode || 'pl');

  const prompt = `You are an SEO content strategist. For the keyword "${keyword}", propose ${Math.max(need, 3)}–${MIN_TOPICS} semantic topic titles for an "AI Search / Info to cover" checklist.${langHint}

Existing titles (keep / refine, do not duplicate):
${existingTitles.map((t) => `- ${t}`).join('\n') || '(none)'}

Sample questions:
${sampleQs.map((q) => `- ${q}`).join('\n')}

Prefer topics that deepen CRITICAL reader problems and concrete examples over encyclopedic type-lists. Do not invent fake credentials topics.

Return ONLY a JSON array of strings (topic titles). No markdown.`;

  try {
    let wieHint = '';
    try {
      const { buildWieWriteContext, formatBoundedCoverageForPrompt } = await import('../wie/writerContext');
      const { formatPolicyBundleForPrompt } = await import('../wie/policyResolver');
      const { formatNarrativePlanForPrompt } = await import('../wie/narrativePlanner');
      const wie = await buildWieWriteContext({ keyword });
      wieHint = [
        formatPolicyBundleForPrompt(wie.policy),
        formatNarrativePlanForPrompt(wie.narrative),
        formatBoundedCoverageForPrompt(wie.synthesis),
      ].filter(Boolean).join('\n');
    } catch { /* optional */ }

    // Dynamic import — keeps ESM @ai-sdk/deepseek out of Jest's static graph.
    const [{ generateText }, { deepseek }] = await Promise.all([
      import('ai'),
      import('../ai/deepseek'),
    ]);
    const { text } = await generateText({
      model: deepseek('deepseek-chat'),
      prompt: wieHint ? `${wieHint}\n\n${prompt}` : prompt,
      maxOutputTokens: 800,
    });
    const generated = parseTitles(text);
    const seen = new Set(existingTitles.map((t) => normalizeTerm(t)));
    const added = generated.filter((t) => {
      const k = normalizeTerm(t);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (!added.length && existingTitles.length >= MIN_TOPICS) {
      return { topics, llmAddedTopics: 0 };
    }

    const allTitles = [...existingTitles, ...added].slice(0, 12);
    const allQs = topics.flatMap((t) => t.questions);
    const reclustering = reclusterIntoTitles(allTitles, allQs);
    return {
      topics: reclustering,
      llmAddedTopics: added.length,
    };
  } catch {
    return { topics, llmAddedTopics: 0 };
  }
}
