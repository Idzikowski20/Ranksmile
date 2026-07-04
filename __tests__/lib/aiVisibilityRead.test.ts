// buildOverview/loadScanResultRows touch the DB; parseCitations + mapDbRowsToResultRows are pure.
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

import { parseCitations, parseBrands, mapDbRowsToResultRows, parseFanOut } from '../../lib/aiVisibilityRead';

describe('parseFanOut', () => {
   it('parses a JSON string (SQLite) and an array (Postgres jsonb)', () => {
      expect(parseFanOut('["a","  b  ",""]')).toEqual(['a', 'b']);
      expect(parseFanOut(['a', 'b'])).toEqual(['a', 'b']);
   });
   it('returns [] for null / bad JSON / non-array / undefined', () => {
      expect(parseFanOut(null)).toEqual([]);
      expect(parseFanOut(undefined)).toEqual([]);
      expect(parseFanOut('{bad')).toEqual([]);
      expect(parseFanOut(42)).toEqual([]);
   });
});

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

describe('parseBrands', () => {
   it('maps array (jsonb) assigning pos by order, coercing fields', () => {
      expect(parseBrands([{ brand: 'Wix', domain: 'wix.com', sentiment: 'positive', quotes: ['q'] }, { nope: 1 }]))
         .toEqual([{ brand: 'Wix', domain: 'wix.com', sentiment: 'positive', pos: 1, quotes: ['q'] }]);
   });
   it('parses a JSON string and returns [] on junk', () => {
      expect(parseBrands(JSON.stringify([{ brand: 'X' }]))).toEqual([{ brand: 'X', domain: '', sentiment: 'neutral', pos: 1, quotes: [] }]);
      expect(parseBrands('{bad')).toEqual([]);
      expect(parseBrands(null)).toEqual([]);
   });
});

describe('mapDbRowsToResultRows', () => {
   it('maps db columns to ResultRow, coercing own_cited to boolean', () => {
      const rows = mapDbRowsToResultRows([
         { prompt_id: 5, model: 'gemini', own_cited: 1, own_position: 2, citations: JSON.stringify([{ url: 'https://idztech.pl', domain: 'idztech.pl', title: '' }]), topic: 'T', text: 'Q', brands: JSON.stringify([{ brand: 'Wix' }]) },
         { prompt_id: 6, model: 'chat_gpt', own_cited: 0, own_position: null, citations: null, topic: 'T2', text: 'Q2', brands: null },
      ]);
      expect(rows[0]).toEqual({ promptId: 5, model: 'gemini', ownCited: true, ownPosition: 2, citations: [{ url: 'https://idztech.pl', domain: 'idztech.pl', title: '' }], topic: 'T', text: 'Q', brands: [{ brand: 'Wix', domain: '', sentiment: 'neutral', pos: 1, quotes: [] }], fanOutQueries: [] });
      expect(rows[1]).toEqual({ promptId: 6, model: 'chat_gpt', ownCited: false, ownPosition: null, citations: [], topic: 'T2', text: 'Q2', brands: [], fanOutQueries: [] });
   });
});
