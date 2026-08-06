import type { JSONContent } from '@tiptap/core';
import type { ApprovedOutlineHeading } from './applyApprovedOutline';
import type { ContentPlannerBundle, SectionBrief, TargetClaim } from './types';

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

// Bundles are persisted into articles.score_data, so briefs written by an older
// planner can reach this code without the newer fields — read them defensively.

/** "Cover: <claim> [gov.pl, sejm.gov.pl]" — the section's evidence travels with it. */
function claimLine(claim: TargetClaim): string {
  const labels = unique((claim.sources || []).map((source) => source.label || source.url));
  const cited = labels.length ? ` [${labels.slice(0, 3).join(', ')}]` : '';
  return `Cover: ${claim.statement}${cited}`;
}

function blockLine(brief: SectionBrief): string[] {
  const blocks = brief.blocks || [];
  if (!blocks.length) return [];
  const hints = (brief.evidence || []).map((item) => item.hint).filter(Boolean);
  const detail = hints.length ? ` — ${hints.slice(0, 2).join('; ')}` : '';
  return [`Include blocks: ${blocks.join(', ')}${detail}`];
}

/** Surfer-style "bridge to the next section" so the writer doesn't restart each time. */
function bridgeLine(brief: SectionBrief): string[] {
  const transition = brief.writerHints?.transition?.trim();
  if (transition) return [`Bridge: ${transition}`];
  const next = brief.writerHints?.nextSection?.trim();
  return next ? [`Bridge to: ${next}`] : [];
}

export function reviewOutlineFromBundle(bundle: ContentPlannerBundle): ApprovedOutlineHeading[] {
  if (!bundle.outline || bundle.briefs.length !== bundle.outline.sections.length) return [];
  const claims = new Map(bundle.targetKg.claims.map((claim) => [claim.id, claim]));
  return [
    { level: 1, text: bundle.outline.h1 },
    ...bundle.briefs.map((brief) => ({
      level: 2,
      text: brief.heading,
      instructions: unique([
        brief.objective,
        ...brief.claimIds
          .map((id) => claims.get(id))
          .filter((claim): claim is TargetClaim => Boolean(claim))
          .map(claimLine),
        ...(brief.mustAnswer || []).map((question) => `Answer: ${question}`),
        ...blockLine(brief),
        ...(brief.evidence || []).map((item) => `Include ${item.kind}: ${item.hint}`),
        ...(brief.freshnessNotes || []),
        ...bridgeLine(brief),
      ]),
      targetWords: brief.budget.words,
    })),
  ];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] || char);
}

export function reviewOutlineToHtml(outline: ApprovedOutlineHeading[]): string {
  return outline.map((item) => {
    const level = Math.min(4, Math.max(1, Number(item.level) || 2));
    const heading = `<h${level}>${escapeHtml(item.text)}</h${level}>`;
    if (level === 1) return heading;
    const instructions = item.instructions?.length
      ? `<ul>${item.instructions.map((instruction) => `<li>${escapeHtml(instruction)}</li>`).join('')}</ul>`
      : '<p></p>';
    const target = item.targetWords
      ? `<p>Target length: ~${item.targetWords} words</p>`
      : '';
    return `${heading}${instructions}${target}`;
  }).join('');
}

function nodeText(node: JSONContent): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content || []).map(nodeText).join(' ').replace(/\s+/g, ' ').trim();
}

function instructionTexts(node: JSONContent): string[] {
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return (node.content || []).map(nodeText).map((text) => text.trim()).filter(Boolean);
  }
  const text = nodeText(node).trim();
  return text ? [text] : [];
}

export function collectApprovedOutline(doc: JSONContent): ApprovedOutlineHeading[] {
  const outline: ApprovedOutlineHeading[] = [];
  let current: ApprovedOutlineHeading | null = null;
  for (const node of doc.content || []) {
    if (node.type === 'heading') {
      const text = nodeText(node).trim();
      if (text) {
        const heading: ApprovedOutlineHeading = {
          level: Number(node.attrs?.level) || 2,
          text,
        };
        outline.push(heading);
        current = heading.level >= 2 ? heading : null;
      }
    } else if (current) {
      for (const text of instructionTexts(node)) {
        const target = text.match(/^Target length:\s*~?(\d+)\s*words?$/i);
        if (target) {
          current.targetWords = Number(target[1]);
        } else {
          current.instructions = unique([...(current.instructions || []), text]);
        }
      }
    }
  }
  return outline;
}
