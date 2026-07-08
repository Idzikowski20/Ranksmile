export type FactSourceKind = 'serp' | 'paa' | 'ai_overview' | 'chat_gpt';

export type ArticleFact = {
  id: string;
  text: string;
  sourceFrequency: number;
  sources: Array<{ url?: string; domain?: string; kind: FactSourceKind }>;
};
