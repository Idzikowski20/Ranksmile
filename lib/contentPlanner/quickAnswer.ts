/**
 * Quick Answer — LLM action-first lead (Planner owns this; Writer only embeds it).
 */
import type { IntentBlueprint, ReaderModel } from './types';

export async function generateQuickAnswer(opts: {
  keyword: string;
  intent: IntentBlueprint;
  reader: ReaderModel;
  signal?: AbortSignal;
  llmEdit?: (userPrompt: string, systemPrompt: string) => Promise<{ html: string; tokens: number }>;
}): Promise<string> {
  const system = [
    'You write the opening Quick Answer for an SEO article.',
    'Action-first: what the reader will learn, time to first results, and the first concrete steps.',
    '2–4 short sentences. No dictionary definitions (“SEO is…” / “SEO to…”).',
    'Plain text only — no HTML, no markdown headings.',
    `Language: match the keyword (Polish if keyword is Polish). Year hint: ${opts.intent.yearHint}.`,
  ].join(' ');

  const user = [
    `Keyword: ${opts.keyword}`,
    `Article type: ${opts.intent.articleType}`,
    `Narrative: ${opts.intent.narrativePreference}`,
    `Reader: ${opts.reader.readerPersona} | goal: ${opts.reader.goal}`,
    `Tone: ${opts.reader.tone}`,
    `Time budget: ~${opts.reader.timeBudgetMinutes} minutes`,
    `First-60s questions: ${opts.intent.first60sQuestions.join(' | ')}`,
    '',
    'Write the Quick Answer now.',
  ].join('\n');

  const { wieLlmComplete } = await import('../wie/writer');
  const { html } = await wieLlmComplete({
    userPrompt: user,
    systemPrompt: system,
    maxTokens: 280,
    temperature: 0.35,
    signal: opts.signal,
    llmEdit: opts.llmEdit,
  });
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 40) {
    throw new Error('quick_answer_too_short');
  }
  if (/^(seo|pozycjonowanie)\s+(to|jest|oznacza)\b/i.test(text)) {
    throw new Error('quick_answer_definition_first');
  }
  return text;
}
