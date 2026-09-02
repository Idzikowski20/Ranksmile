/** @jest-environment node */
/**
 * validateSeoAgainstBlueprint must notice a flat article.
 *
 * Heading count is graded against competitor body density, and the writer emitted no H3
 * whatsoever — so a flat article passed every post-write check while losing the headings
 * slot. This locks the gap shut from the validator side.
 */
import { validateSeoAgainstBlueprint } from '@/src/core/domain/contentPlanner/postWriteValidators';
import type { ArticleBlueprint } from '@/src/core/domain/contentPlanner/types';

/** A blueprint whose ~218-word sections earn one subheading each. */
const blueprint = {
  targetWords: 1300,
  targetH2: 6,
  targetLists: 2,
} as unknown as ArticleBlueprint;

/** Sections short enough to stay flat — 156 words each expects zero subheadings. */
const flatBlueprint = {
  targetWords: 934,
  targetH2: 6,
  targetLists: 2,
} as unknown as ArticleBlueprint;

const body = (perSection: string) => `<h1>T</h1>${
  Array.from({ length: 6 }, (_, i) => `<h2>S${i}</h2>${perSection}`).join('')
}<ul><li>a</li></ul><ul><li>b</li></ul>`;

const words = (n: number) => `<p>${'slowo '.repeat(n)}</p>`;

const codes = (html: string, bp: ArticleBlueprint) => validateSeoAgainstBlueprint(html, bp).issues.map((i) => i.code);

describe('validateSeoAgainstBlueprint — H3 nesting', () => {
  it('flags an article that shipped no subheadings at all', () => {
    const html = body(words(216));
    expect(codes(html, blueprint)).toContain('h3_below');
  });

  it('accepts the same article once its sections are nested', () => {
    const html = body(`${words(108)}<h3>Podteza</h3>${words(108)}`);
    expect(codes(html, blueprint)).not.toContain('h3_below');
  });

  it('reports how many subheadings are missing', () => {
    const issue = validateSeoAgainstBlueprint(body(words(216)), blueprint)
      .issues.find((i) => i.code === 'h3_below');
    // Six sections × one subheading, halved for slack → three expected, none present.
    expect(issue?.missing).toBe(3);
  });

  it('never asks a short-section article to nest', () => {
    const html = body(words(155));
    expect(codes(html, flatBlueprint)).not.toContain('h3_below');
  });
});
