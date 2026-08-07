import React from 'react';
import { prefersReducedMotion } from '../../lib/motion/gsap';

/**
 * The document surface while a run is writing into it: [height, width, top margin].
 * Row 0 is the title, the 20px rows are headings, the 12px rows body lines — enough
 * shape to read as "an article is landing here", with no copy (the bottom pill already
 * says "Generating outline" / "Generating content N%").
 */
const ROWS: ReadonlyArray<readonly [number, string, number]> = [
  [34, '72%', 0],
  [12, '97%', 34], [12, '91%', 14], [12, '95%', 14], [12, '66%', 14],
  [20, '44%', 34],
  [12, '94%', 20], [12, '98%', 14], [12, '88%', 14], [12, '73%', 14],
  [20, '37%', 34],
  [12, '96%', 20], [12, '89%', 14], [12, '58%', 14],
];

export type ArticleGenerationSkeletonProps = {
  /** An outline is being planned, or the article is being written. */
  busy: boolean;
  /** The document is still empty — real content always wins over the skeleton. */
  empty: boolean;
};

/**
 * Placeholder article shown over the empty canvas for the length of a generate run.
 * Decoration only (`aria-hidden`) — the progress pill owns the live-region announcement.
 */
const ArticleGenerationSkeleton = ({ busy, empty }: ArticleGenerationSkeletonProps) => {
  if (!busy || !empty) return null;
  // Static block under reduced motion: no shimmer, no stagger — just the shape.
  const still = prefersReducedMotion();
  return (
    <div
      className="art-gen-skeleton"
      data-static={still ? 'true' : 'false'}
      data-testid="article-generation-skeleton"
      aria-hidden="true"
    >
      {ROWS.map(([height, width, marginTop], i) => (
        <div
          key={`${i}-${width}`}
          className="koala-skeleton-block"
          style={{
            height,
            width,
            marginTop,
            borderRadius: height > 24 ? 8 : 5,
            animationDelay: still ? undefined : `${i * 0.07}s`,
          }}
        />
      ))}
    </div>
  );
};

export default ArticleGenerationSkeleton;
