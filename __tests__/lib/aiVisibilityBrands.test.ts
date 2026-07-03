// Import the pure helpers directly; the main aiVisibilityBrands module pulls in
// @ai-sdk/deepseek which is ESM and would need extra Jest config to load.
import { parseBrandResponse, buildBrandPrompt } from '../../lib/aiVisibilityBrandsPure';

describe('parseBrandResponse', () => {
   it('parses an array, coercing fields and clamping quotes to 3', () => {
      const out = parseBrandResponse([
         { brand: 'Wix', domain: 'wix.com', sentiment: 'positive', quotes: ['a', 'b', 'c', 'd'] },
         { brand: 'Squarespace' },
         { domain: 'x.com' }, // no brand → dropped
      ]);
      expect(out).toEqual([
         { brand: 'Wix', domain: 'wix.com', sentiment: 'positive', quotes: ['a', 'b', 'c'] },
         { brand: 'Squarespace', domain: '', sentiment: 'neutral', quotes: [] },
      ]);
   });
   it('accepts a JSON string and unknown sentiment defaults to neutral', () => {
      const out = parseBrandResponse(JSON.stringify([{ brand: 'Duda', sentiment: 'weird' }]));
      expect(out).toEqual([{ brand: 'Duda', domain: '', sentiment: 'neutral', quotes: [] }]);
   });
   it('returns [] on null / non-array / invalid JSON', () => {
      expect(parseBrandResponse(null)).toEqual([]);
      expect(parseBrandResponse('{not json')).toEqual([]);
      expect(parseBrandResponse({})).toEqual([]);
   });
   it('strips ```json fences that models sometimes wrap around the array', () => {
      const out = parseBrandResponse('```json\n[{"brand":"Wix"}]\n```');
      expect(out).toEqual([{ brand: 'Wix', domain: '', sentiment: 'neutral', quotes: [] }]);
   });
});

describe('buildBrandPrompt', () => {
   it('includes the answer text and own brand and asks for JSON', () => {
      const p = buildBrandPrompt('Wix is great', 'idztech');
      expect(p).toContain('Wix is great');
      expect(p).toContain('idztech');
      expect(p.toLowerCase()).toContain('json');
   });
});
