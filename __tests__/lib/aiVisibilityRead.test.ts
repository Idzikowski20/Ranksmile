// buildOverview/loadScanResultRows touch the DB; parseCitations + mapDbRowsToResultRows are pure.
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

import { parseCitations, mapDbRowsToResultRows } from '../../lib/aiVisibilityRead';

describe('parseCitations', () => {
   it('coerces missing domain/title to empty strings and drops non-url entries', () => {
      const out = parseCitations(JSON.stringify([{ url: 'https://a.com/x' }, { title: 'no url' }, { url: 'https://b.com', domain: 'b.com', title: 'B' }]));
      expect(out).toEqual([
         { url: 'https://a.com/x', domain: '', title: '' },
         { url: 'https://b.com', domain: 'b.com', title: 'B' },
      ]);
   });
   it('returns [] on null or invalid JSON', () => {
      expect(parseCitations(null)).toEqual([]);
      expect(parseCitations('{not json')).toEqual([]);
   });
   it('accepts an already-parsed array (Postgres jsonb comes back parsed, not a string)', () => {
      const out = parseCitations([{ url: 'https://a.com', domain: 'a.com', title: 'A' }, { nope: true }]);
      expect(out).toEqual([{ url: 'https://a.com', domain: 'a.com', title: 'A' }]);
   });
});

describe('mapDbRowsToResultRows', () => {
   it('maps db columns to ResultRow, coercing own_cited to boolean', () => {
      const rows = mapDbRowsToResultRows([
         { prompt_id: 5, model: 'gemini', own_cited: 1, own_position: 2, citations: JSON.stringify([{ url: 'https://idztech.pl', domain: 'idztech.pl', title: '' }]) },
         { prompt_id: 6, model: 'chat_gpt', own_cited: 0, own_position: null, citations: null },
      ]);
      expect(rows[0]).toEqual({ promptId: 5, model: 'gemini', ownCited: true, ownPosition: 2, citations: [{ url: 'https://idztech.pl', domain: 'idztech.pl', title: '' }] });
      expect(rows[1]).toEqual({ promptId: 6, model: 'chat_gpt', ownCited: false, ownPosition: null, citations: [] });
   });
});
