/**
 * View-model helpers for the Keyword Research detail page. Adapts the shared
 * TopicResearchResult (clusters → ideas → keywords) into Surfer-style keyword
 * clusters: one card per cluster, showing an intent badge, MSV/KD and the flat
 * list of keywords in that cluster.
 */
import type { TopicResearchResult } from './topicResearchTypes';

export type KwIntent = 'Informational' | 'Local' | 'Shopping' | 'Customer Investigation' | 'Not detected';

export interface KwKeyword {
   keyword: string;
   volume: number | null;
   kd: number | null;
   position: number | null;
}

export interface KwCluster {
   index: number;
   /** Highest-volume keyword — used as the card headline. */
   title: string;
   intent: KwIntent;
   msv: number;
   kd: number;
   /** Estimated monthly organic clicks across the cluster's keywords. */
   totalTraffic: number;
   keywords: KwKeyword[];
}

const SHOPPING_RE = /\b(cena|ceny|cennik|koszt|kosztuje|price|cost|kup|kupić|kupno|buy|sklep|tani|tania|tanie|promocj|wycena|abonament)\b/i;
const LOCAL_RE = /\b(near me|w pobli|kraków|krakow|warszaw|wrocław|wroclaw|bydgoszcz|gdańsk|gdansk|poznań|poznan|łódź|lodz|katowic|lublin|szczecin|okolic)\b/i;
const INFO_RE = /\b(jak|co to|czym|dlaczego|kiedy|gdzie|poradnik|zasady|przykład|how|what|why|when|guide|tutorial|definicja)\b/i;

export function deriveIntent(keywords: string[]): KwIntent {
   const joined = keywords.join(' ').toLowerCase();
   if (LOCAL_RE.test(joined)) return 'Local';
   if (SHOPPING_RE.test(joined)) return 'Shopping';
   if (INFO_RE.test(joined)) return 'Informational';
   return 'Not detected';
}

/** Standard organic CTR curve → estimate clicks from search volume + SERP position. */
const ctrForPosition = (pos: number | null): number => {
   if (pos == null || pos <= 0) return 0;
   if (pos === 1) return 0.30;
   if (pos === 2) return 0.15;
   if (pos === 3) return 0.10;
   if (pos <= 10) return 0.05;
   if (pos <= 20) return 0.02;
   return 0.005;
};

export function buildKwClusters(result: TopicResearchResult): KwCluster[] {
   return result.clusters.map((cluster) => {
      const seen = new Map<string, KwKeyword>();
      for (const idea of cluster.ideas) {
         for (const kw of idea.keywords) {
            const key = kw.keyword.toLowerCase().trim();
            if (!key || seen.has(key)) continue;
            seen.set(key, { keyword: kw.keyword, volume: kw.volume, kd: kw.kd, position: kw.position });
         }
      }
      const keywords = Array.from(seen.values()).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      const totalTraffic = Math.round(
         keywords.reduce((sum, k) => sum + (k.volume ?? 0) * ctrForPosition(k.position), 0),
      );
      return {
         index: cluster.index,
         title: keywords[0]?.keyword ?? cluster.title,
         intent: deriveIntent(keywords.map((k) => k.keyword)),
         msv: cluster.volume,
         kd: cluster.kd,
         totalTraffic,
         keywords,
      };
   });
}

export const INTENTS: KwIntent[] = ['Local', 'Customer Investigation', 'Informational', 'Shopping', 'Not detected'];

export const fmtNum = (v: number | null | undefined): string => {
   if (v == null) return '—';
   if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}m`;
   if (v >= 100_000) return `${Math.round(v / 1_000)}k`;
   if (v >= 10_000) return `${(v / 1_000).toFixed(1)}k`;
   return v.toLocaleString('en-US');
};
