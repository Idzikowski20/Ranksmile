import { parseLlmItems, parseAiModeItems, parseAiOverview, isRetryable } from '../../lib/dataforseoLlm';

describe('parseLlmItems (chat_gpt/gemini/perplexity)', () => {
   const items = [
      { type: 'reasoning', sections: [{ type: 'summary_text', text: 'thinking…' }] },
      {
         type: 'message',
         sections: [{
            type: 'text',
            text: 'The amusement park industry in France remains significant.',
            annotations: [
               { title: 'France Parks Report', url: 'https://www.grandviewresearch.com/report' },
               { title: 'Wiki', url: 'https://en.wikipedia.org/wiki/Parc' },
            ],
         }],
      },
   ];
   it('extracts message text and citations with derived domains', () => {
      const out = parseLlmItems(items);
      expect(out.text).toContain('amusement park industry');
      expect(out.citations).toHaveLength(2);
      expect(out.citations[0]).toEqual({ title: 'France Parks Report', url: 'https://www.grandviewresearch.com/report', domain: 'grandviewresearch.com' });
   });
   it('ignores reasoning items and survives malformed input', () => {
      expect(parseLlmItems([])).toEqual({ text: '', citations: [] });
      expect(parseLlmItems([{ type: 'message' }, null as unknown as object])).toEqual({ text: '', citations: [] });
   });
});

describe('parseAiModeItems (serp/google/ai_mode)', () => {
   it('reads text + references + links, prefers www-stripped supplied domain', () => {
      const out = parseAiModeItems([{
         text: 'Best CRMs include...',
         references: [{ url: 'https://www.hubspot.com/crm', title: 'HubSpot CRM', domain: 'www.hubspot.com' }],
         links: [{ url: 'https://pipedrive.com/', title: 'Pipedrive' }],
      }]);
      expect(out.text).toContain('Best CRMs');
      expect(out.citations).toHaveLength(2);
      expect(out.citations[0].domain).toBe('hubspot.com');
      expect(out.citations[1].domain).toBe('pipedrive.com');
   });
   it('falls back to markdown when text missing', () => {
      expect(parseAiModeItems([{ markdown: '# Answer' }]).text).toBe('# Answer');
   });
});

describe('parseAiOverview (ai_overview element in organic SERP)', () => {
   it('picks only the ai_overview element and flattens its references/links', () => {
      const out = parseAiOverview([
         { type: 'organic', title: 'ignore me', url: 'https://ignore.com' },
         {
            type: 'ai_overview',
            markdown: 'AI overview answer',
            items: [{ text: 'point one', links: [{ url: 'https://oracle.com/x', title: 'Oracle' }] }],
            references: [{ url: 'https://www.reddit.com/r/x', title: 'Reddit thread', domain: 'www.reddit.com' }],
         },
      ]);
      expect(out.text).toContain('AI overview answer');
      expect(out.text).toContain('point one');
      const domains = out.citations.map((c) => c.domain).sort();
      expect(domains).toEqual(['oracle.com', 'reddit.com']);
      expect(out.citations.find((c) => c.domain === 'ignore.com')).toBeUndefined();
   });
});

describe('isRetryable', () => {
   it('retries 429/5xx/timeout, not 4xx', () => {
      expect(isRetryable({ response: { status: 429 } })).toBe(true);
      expect(isRetryable({ response: { status: 503 } })).toBe(true);
      expect(isRetryable({ code: 'ETIMEDOUT' })).toBe(true);
      expect(isRetryable({ response: { status: 400 } })).toBe(false);
      expect(isRetryable({ response: { status: 404 } })).toBe(false);
   });
});
