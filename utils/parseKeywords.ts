import Keyword from '../database/models/keyword';
import { safeJsonParse } from '../lib/safeJson';

/**
 * Parses the SQL Keyword Model object to frontend consumable object.
 * @param {Keyword[]} allKeywords - Keywords to scrape
 * @returns {KeywordType[]}
 */
const parseKeywords = (allKeywords: Keyword[]) : KeywordType[] => {
   // Guard every JSON.parse: a single corrupt row must not throw and break the entire list/refresh.
   const parsedItems = allKeywords.map((keywrd:Keyword) => ({
         ...keywrd,
         history: safeJsonParse<KeywordType['history']>(keywrd.history, {}),
         tags: safeJsonParse<string[]>(keywrd.tags, []),
         lastResult: safeJsonParse<KeywordType['lastResult']>(keywrd.lastResult, []),
         lastUpdateError: keywrd.lastUpdateError && keywrd.lastUpdateError !== 'false' && keywrd.lastUpdateError.includes('{')
            ? safeJsonParse<KeywordType['lastUpdateError']>(keywrd.lastUpdateError, false) : false,
      }));
   return parsedItems;
};

export default parseKeywords;
