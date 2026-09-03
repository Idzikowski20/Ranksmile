/** @jest-environment node */
/**
 * Sources reports whether the cited PAGE names our brand (the reading-sources phase), the
 * same thing the reference tool counts per domain — with a third bucket for pages nobody
 * has read yet, which must never be reported as "does not mention".
 */
import { pageKind, mentionCounts, type SourceRow } from '@/components/aiVisibility/SourcesTable';

const src = (url: string, pageMentionsBrand?: boolean): SourceRow => ({
   url, domain: 'x.pl', timesShown: 1, models: ['chat_gpt'], pageMentionsBrand,
});

describe('pageKind', () => {
   it('is unknown until the page has been read', () => {
      expect(pageKind(src('/a'))).toBe('unknown');
      expect(pageKind(src('/a', true))).toBe('yes');
      expect(pageKind(src('/a', false))).toBe('no');
   });

   it('ignores whether the ANSWER named us — this column is about the page', () => {
      expect(pageKind({ ...src('/a'), mentioned: true })).toBe('unknown');
   });
});

describe('mentionCounts', () => {
   it('splits a domain’s pages three ways', () => {
      expect(mentionCounts([src('/a', true), src('/b', false), src('/c'), src('/d', true)]))
         .toEqual({ mentioned: 2, notMentioned: 1, missing: 1 });
   });

   it('a domain with no pages read yet counts as all missing', () => {
      expect(mentionCounts([src('/a'), src('/b')])).toEqual({ mentioned: 0, notMentioned: 0, missing: 2 });
      expect(mentionCounts([])).toEqual({ mentioned: 0, notMentioned: 0, missing: 0 });
   });
});
