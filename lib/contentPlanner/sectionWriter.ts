/**
 * Section Memory, Humanizer hints, Assembler, prompt blocks for Writer.
 */
import type { AdaptiveOutline, ReaderModel, SectionBrief, TargetKnowledgeGraph } from './types';

export type SectionMemory = {
  previousHeading: string | null;
  nextHeading: string | null;
  entitiesAlreadyUsed: string[];
  claimsAlreadyCovered: string[];
  questionsAlreadyCovered: string[];
  articleGoals: string;
};

export function buildSectionMemory(opts: {
  outline: AdaptiveOutline;
  sectionIndex: number;
  reader: ReaderModel;
  coveredClaimIds: string[];
  coveredQuestionIds: string[];
  usedEntities: string[];
}): SectionMemory {
  const { outline, sectionIndex } = opts;
  const prev = sectionIndex > 0 ? outline.sections[sectionIndex - 1] : null;
  const next = sectionIndex < outline.sections.length - 1 ? outline.sections[sectionIndex + 1] : null;
  return {
    previousHeading: prev?.heading ?? null,
    nextHeading: next?.heading ?? null,
    entitiesAlreadyUsed: opts.usedEntities,
    claimsAlreadyCovered: opts.coveredClaimIds,
    questionsAlreadyCovered: opts.coveredQuestionIds,
    articleGoals: opts.reader.goal,
  };
}

export function formatSectionWriterPrompt(opts: {
  brief: SectionBrief;
  memory: SectionMemory;
  kg: TargetKnowledgeGraph;
  reader: ReaderModel;
}): string {
  const claims = opts.kg.claims.filter((c) => opts.brief.claimIds.includes(c.id));
  const questions = opts.kg.questions.filter((q) => opts.brief.questionIds.includes(q.id));
  const lines = [
    'SECTION WRITER — write ONLY this section as HTML (h2 + body).',
    `Reader persona: ${opts.reader.readerPersona}; tone: ${opts.reader.tone}`,
    `Goal: ${opts.memory.articleGoals}`,
    `H2: ${opts.brief.heading}`,
    `Objective: ${opts.brief.objective}`,
    `Budget: ${opts.brief.budget.words} words; claims=${opts.brief.budget.claims}; examples=${opts.brief.budget.examples}`,
    `Blocks (in order): ${opts.brief.blocks.join(' → ')}`,
    'Claims to cover:',
    ...claims.map((c) => `  • ${c.statement} [${c.priority}/${c.gainClass}]`),
    'Questions to answer:',
    ...questions.map((q) => `  • ${q.question}`),
    'Evidence:',
    ...opts.brief.evidence.map((e) => `  • ${e.kind}: ${e.hint}`),
    opts.brief.freshnessNotes.length ? `Freshness: ${opts.brief.freshnessNotes.join('; ')}` : '',
    opts.memory.previousHeading ? `Previous section: ${opts.memory.previousHeading}` : '',
    opts.memory.nextHeading ? `Next section: ${opts.memory.nextHeading}` : '',
    opts.memory.claimsAlreadyCovered.length
      ? `Do NOT repeat claims: ${opts.memory.claimsAlreadyCovered.join(', ')}`
      : '',
    'HARD: No dictionary openings. Prefer actions, lists, concrete examples.',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Deterministic humanizer pass — tighten whitespace / ensure short-paragraph bias in hints. */
export function humanizeSectionHtml(html: string): string {
  return (html || '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+<\/(p|li|h2|h3)>/gi, '</$1>')
    .trim();
}

export function assembleArticle(opts: {
  h1: string;
  sectionHtmls: string[];
  introHtml?: string;
}): string {
  const intro =
    opts.introHtml
    || `<p>Chcesz ${escapeHtml(opts.h1)}, ale nie wiesz od czego zacząć? Poniżej znajdziesz praktyczny plan działania — bez pustych obietnic.</p>`;
  const body = opts.sectionHtmls.map(humanizeSectionHtml).filter(Boolean).join('\n');
  return `<h1>${escapeHtml(opts.h1)}</h1>\n${intro}\n${body}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Offline stub writer for tests / dry-run — emits block-shaped HTML from brief. */
export function stubWriteSection(opts: {
  brief: SectionBrief;
  kg: TargetKnowledgeGraph;
}): string {
  const claims = opts.kg.claims.filter((c) => opts.brief.claimIds.includes(c.id));
  const questions = opts.kg.questions.filter((q) => opts.brief.questionIds.includes(q.id));
  const parts: string[] = [`<h2>${escapeHtml(opts.brief.heading)}</h2>`];
  for (const block of opts.brief.blocks) {
    if (block === 'checklist' || block === 'steps') {
      parts.push('<ul>');
      for (const c of claims.slice(0, Math.max(2, opts.brief.budget.claims))) {
        parts.push(`<li>${escapeHtml(c.statement)}</li>`);
      }
      if (claims.length === 0) parts.push('<li>Wykonaj pierwszy krok z planu.</li>');
      parts.push('</ul>');
    } else if (block === 'faq') {
      for (const q of questions.slice(0, Math.max(2, opts.brief.budget.faq || 3))) {
        parts.push(`<p><strong>${escapeHtml(q.question)}</strong> ${escapeHtml(q.requiredAnswerBrief)}</p>`);
      }
    } else if (block === 'warning') {
      parts.push('<p><strong>Uwaga:</strong> Unikaj masowych pakietów linków i gwarancji TOP1.</p>');
    } else if (block === 'table') {
      parts.push('<p>Porównanie opcji: samodzielnie vs agencja vs konsultacje — wybierz wg budżetu czasu.</p>');
    } else if (block === 'example') {
      const ex = claims[0]?.statement || opts.brief.evidence.find((e) => e.kind === 'example')?.hint || 'Przykład wdrożenia';
      parts.push(`<p>Przykład: ${escapeHtml(ex)}</p>`);
    } else if (block === 'summary') {
      parts.push('<p>Podsumowanie: wdrażaj, mierz w Search Console, iteruj co 2–4 tygodnie.</p>');
    } else {
      for (const c of claims.slice(0, 2)) {
        parts.push(`<p>${escapeHtml(c.statement)}</p>`);
      }
      if (!claims.length) parts.push(`<p>${escapeHtml(opts.brief.objective)}</p>`);
    }
  }
  return parts.join('\n');
}
