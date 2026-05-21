const POLISH_STOPWORDS = new Set([
   'aby', 'ale', 'albo', 'ani', 'bez', 'bo', 'by', 'byc', 'być', 'byla', 'była',
   'bylo', 'było', 'byly', 'były', 'czy', 'dla', 'do', 'gdy', 'gdzie', 'go',
   'ich', 'im', 'jest', 'jesli', 'jeśli', 'juz', 'już', 'kiedy', 'kto', 'ktora',
   'która', 'ktore', 'które', 'ktory', 'który', 'lub', 'ma', 'mial', 'miał',
   'miec', 'mieć', 'moze', 'może', 'na', 'nad', 'nie', 'nim', 'oraz', 'po',
   'pod', 'przed', 'przez', 'przy', 'sa', 'są', 'sie', 'się', 'tak', 'te',
   'tego', 'tej', 'ten', 'to', 'tych', 'tym', 'u', 'w', 'we', 'z', 'za', 'ze',
   'że',
]);

export type ArticleTerm = {
   term: string;
   target_count: number;
   current_count?: number;
   term_type?: 'keyword' | 'topic' | 'entity' | 'question';
};

export function normalizeTerm(term: string): string {
   return term.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isUsefulTerm(term: string): boolean {
   const normalized = normalizeTerm(term);
   if (normalized.length < 4) return false;
   const tokens = normalized.split(' ');
   if (tokens.every((token) => POLISH_STOPWORDS.has(token))) return false;
   if (tokens.length === 1 && POLISH_STOPWORDS.has(tokens[0])) return false;
   if (/^\d+$/.test(normalized)) return false;
   return true;
}

export function dedupeUsefulTerms<T extends ArticleTerm>(terms: T[]): T[] {
   const seen = new Set<string>();
   const result: T[] = [];
   for (const term of terms) {
      const key = normalizeTerm(term.term);
      if (!isUsefulTerm(key) || seen.has(key)) continue;
      seen.add(key);
      result.push({ ...term, term: key });
   }
   return result;
}
