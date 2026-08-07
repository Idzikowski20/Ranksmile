/**
 * Section briefs written by an LLM, not assembled from scraped strings.
 *
 * The planner used to hand the reviewer its own evidence: `Cover: <sentence lifted from a
 * competitor's page>`. That is why real outlines shipped a rival's address, a rival's
 * licence number, a rival's testimonials and a cookie-consent line as instructions — the
 * planner had nothing else to say, because competitor corpus was its only vocabulary and
 * brand knowledge never reached it at all.
 *
 * Here the competitor evidence is INPUT and the brief is OUTPUT: the model is told about
 * our company, shown what the ranking pages cover, and asked to write instructions for
 * our writer. Same contract Surfer's brief has.
 */
import type { ApprovedOutlineHeading } from './applyApprovedOutline';
import type { ContentPlannerBundle, SectionBrief, TargetClaim } from './types';

/** Evidence per section, capped so a 15-section outline stays inside one call. */
const CLAIMS_PER_SECTION = 6;
const QUESTIONS_PER_SECTION = 3;
const BRAND_CHARS = 2000;
const TERMS = 24;

export type BriefWriterInput = {
  keyword: string;
  bundle: ContentPlannerBundle;
  /** The user's own company document — the whole point of this module. */
  brandKnowledge: string;
  brandName?: string;
  /** NLP terms the article has to carry, strongest first. */
  importantTerms?: string[];
  language?: string;
  signal?: AbortSignal;
  llmEdit?: (userPrompt: string, systemPrompt: string) => Promise<{ html: string; tokens: number }>;
};

type LlmSection = { heading?: unknown; instructions?: unknown };
type LlmBrief = { title?: unknown; sections?: unknown };

function claimTexts(brief: SectionBrief, claims: Map<string, TargetClaim>): string[] {
  return brief.claimIds
    .map((id) => claims.get(id)?.statement)
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .slice(0, CLAIMS_PER_SECTION);
}

function asStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.replace(/^[\s*-]+/, '').trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Strips the fences and prose models wrap JSON in, then parses the first object. */
function parseBrief(raw: string): LlmBrief | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[0]);
    return parsed && typeof parsed === 'object' ? (parsed as LlmBrief) : null;
  } catch {
    return null;
  }
}

function buildPrompt(input: BriefWriterInput): { system: string; user: string } {
  const { bundle } = input;
  const lang = (input.language || bundle.reader.language || 'pl').startsWith('en') ? 'en' : 'pl';
  const claims = new Map(bundle.targetKg.claims.map((c) => [c.id, c]));
  const brand = input.brandKnowledge.trim().slice(0, BRAND_CHARS);

  const system = [
    'You write the section brief for an SEO article — instructions for a writer, never the article itself.',
    'Each instruction is one sentence telling the writer what to cover, in the imperative.',
    'Ground every claim about the business in the BRAND section. Never name, quote or describe a competitor:',
    'their pages are shown to you only as evidence of what the topic requires.',
    'Never copy a competitor sentence, address, licence number, phone number or testimonial.',
    lang === 'pl' ? 'Write in Polish.' : 'Write in English.',
    'Reply with JSON only: {"title": string, "sections": [{"heading": string, "instructions": string[]}]}',
    'Give each section 4-6 instructions. Keep every heading exactly as given.',
  ].join(' ');

  const sections = bundle.briefs.map((brief, i) => {
    const questions = [...(brief.mustAnswer || [])].slice(0, QUESTIONS_PER_SECTION);
    return [
      `${i + 1}. ${brief.heading}`,
      `   objective: ${brief.objective}`,
      `   words: ~${brief.budget.words}`,
      questions.length ? `   must answer: ${questions.join(' | ')}` : '',
      claimTexts(brief, claims).length
        ? `   what ranking pages cover here (evidence, do not copy): ${claimTexts(brief, claims).join(' | ')}`
        : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const user = [
    `Keyword: ${input.keyword}`,
    input.brandName ? `Company: ${input.brandName}` : '',
    '',
    'BRAND — everything the article says about "us" must come from here:',
    brand || '(no brand document provided — write structural instructions only, invent no facts)',
    '',
    input.importantTerms?.length
      ? `Terms to weave in across the article: ${input.importantTerms.slice(0, TERMS).join(', ')}`
      : '',
    '',
    `Working H1: ${bundle.outline?.h1 || input.keyword}`,
    'Rewrite it as a real page title: what we are, who we serve, why us. Keep the keyword in it.',
    '',
    'SECTIONS:',
    sections,
    '',
    'Write the brief now.',
  ].filter((line) => line !== '').join('\n');

  return { system, user };
}

/**
 * Returns `null` rather than throwing: a brief is an improvement on the extracted outline,
 * never a precondition for it. The caller falls back to `reviewOutlineFromBundle`.
 */
export async function writeOutlineBrief(input: BriefWriterInput): Promise<ApprovedOutlineHeading[] | null> {
  const { bundle } = input;
  if (!bundle.outline || !bundle.briefs.length) return null;

  const { system, user } = buildPrompt(input);
  let raw = '';
  try {
    const { wieLlmComplete } = await import('../wie/writer');
    const res = await wieLlmComplete({
      userPrompt: user,
      systemPrompt: system,
      // Reasoning models share this budget; 15 sections × 6 instructions needs headroom.
      maxTokens: 6000,
      temperature: 0.4,
      signal: input.signal,
      llmEdit: input.llmEdit,
    });
    raw = res.html;
  } catch (err) {
    console.warn('[briefWriter] LLM brief failed:', err instanceof Error ? err.message : err);
    return null;
  }

  const parsed = parseBrief(raw.replace(/<[^>]+>/g, ''));
  if (!parsed) {
    console.warn('[briefWriter] could not parse brief JSON');
    return null;
  }

  const written = new Map<string, string[]>();
  if (Array.isArray(parsed.sections)) {
    for (const section of parsed.sections as LlmSection[]) {
      const heading = typeof section?.heading === 'string' ? section.heading.trim() : '';
      const instructions = asStringList(section?.instructions, 8);
      if (heading && instructions.length) written.set(heading.toLowerCase(), instructions);
    }
  }
  // A brief that covered none of the planned sections is a failed call, not a thin one.
  if (!written.size) {
    console.warn('[briefWriter] brief matched no planned section');
    return null;
  }

  const title = typeof parsed.title === 'string' && parsed.title.trim()
    ? parsed.title.trim()
    : bundle.outline.h1;

  return [
    { level: 1, text: title },
    ...bundle.briefs.map((brief) => ({
      level: 2,
      text: brief.heading,
      // Sections the model skipped keep the planner's objective — better a plain line
      // than a gap the reviewer has to notice.
      instructions: written.get(brief.heading.toLowerCase()) ?? [brief.objective],
      targetWords: brief.budget.words,
    })),
  ];
}
