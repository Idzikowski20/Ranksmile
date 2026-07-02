/**
 * Topical Map data adapter.
 *
 * The topics API (`/api/domains/[slug]/topics`) only stores { id, title, summary }.
 * Every richer signal the Topical Map UI shows — keywords, KD/volume, coverage,
 * competitors, opportunity, AI-gap — is derived HERE from a stable FNV-1a hash
 * of the topic title, so the UI renders consistent demo data with no randomness.
 * When the real coverage engine (lib/aiCoverage, python-sidecar) starts emitting
 * these signals, swap the internals of buildTopicClusters and the UI stays put.
 */

export type TopicStatus = 'covered' | 'not_covered' | 'recommended';
export type ArticleStatus = 'Not started' | 'In progress' | 'Done' | 'Covered';

export type TopicKeyword = {
   text: string;
   isMain: boolean;
   covered: boolean;
   position: number | null;
   kd: number;
   impressions: number | null;
   vol: number;
};

export type KeywordGroup = {
   /** URL path for covered groups (e.g. "/aplikacje-webowe"); null for "Not Covered". */
   url: string | null;
   label: string;
   keywords: TopicKeyword[];
};

export type TopicCompetitor = { domain: string; path: string; href: string };

export type CoverageDim = { label: string; value: number };
export type AiGapItem = { label: string; have: number; total: number };

export type Opportunity = {
   score: number;
   tier: 'Very High' | 'High' | 'Medium' | 'Low';
   estGainClicks: number;
   difficulty: 'Easy' | 'Medium' | 'Hard';
   priority: 'High' | 'Medium' | 'Low';
};

export type TopicCluster = {
   id: number;
   name: string;
   mainKeyword: string;
   keywords: TopicKeyword[];
   groups: KeywordGroup[];
   competitors: TopicCompetitor[];
   kd: number;
   vol: number;
   position: number | null;
   impressions: number;
   covRatio: string;
   status: TopicStatus;
   articleStatus: ArticleStatus;
   dims: CoverageDim[];
   aiGap: AiGapItem[];
   opportunity: Opportunity;
   aiAuthority: { score: number; subs: { label: string; value: number }[] };
   /** Radar position: x/y in [-1,1] (0,0 = center = High/High), size multiplier. */
   map: { x: number; y: number; size: number };
};

export const hashStr = (s: string): number => {
   let h = 2166136261;
   for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
   }
   return h >>> 0;
};

const unit = (seed: number, salt: number): number => (hashStr(`${seed}:${salt}`) % 10000) / 10000;
const between = (seed: number, salt: number, min: number, max: number): number => min + unit(seed, salt) * (max - min);
const round1 = (n: number): number => Math.round(n * 10) / 10;

export const slugify = (s: string): string => s
   .toLowerCase()
   .replace(/ł/g, 'l')
   .normalize('NFD')
   .replace(/[̀-ͯ]/g, '')
   .replace(/[^a-z0-9]+/g, '-')
   .replace(/(^-|-$)/g, '');

const COMPETITOR_POOL = [
   'pti.cs.pollub.pl', 'informatyka.orawskie.pl', 'sosw.poznan.pl', 'akanza.pl',
   'certyfikaty.byd.pl', 'imakeable.com', 'imoli.dev', 'impicode.pl',
   'it-solve.pl', 'kursykomputerowe.pl', 'pl.wikipedia.org', 'smartbees.pl',
   'solv.pl', 'strefakursow.pl', 'systemy-it.com', 'szkolareacta.pl',
   'thestory.is', 'a-creative.pl', 'abc-wiedzy.pl', 'usosweb.umk.pl',
];

const SUPPORT_TEMPLATES: Array<(m: string) => string> = [
   (m) => `programowanie ${m}`,
   (m) => `${m} kurs`,
   (m) => `jak wybrac ${m}`,
   (m) => `${m} dla firm`,
   (m) => `${m} przyklady`,
];

const DIM_LABELS = ['Coverage', 'SEO', 'AI Search', 'Authority', 'Freshness', 'Internal Links', 'Intent'];
const GAP_LABELS = ['Entities', 'Facts', 'Comparisons', 'Examples', 'Statistics', 'Definitions', 'FAQs', 'Citations'];
const AUTH_LABELS = ['Coverage', 'Trust', 'Freshness', 'Citation', 'Entity depth', 'Source quality'];

const buildKeywords = (seed: number, main: string, status: TopicStatus): TopicKeyword[] => {
   const supporting = 2 + (hashStr(`${seed}:kwc`) % 3); // 2..4
   const tplBase = hashStr(`${seed}:tb`) % SUPPORT_TEMPLATES.length;
   const kws: TopicKeyword[] = [{
      text: main,
      isMain: true,
      covered: status === 'covered',
      position: status === 'covered' ? round1(between(seed, 1, 3, 75)) : null,
      kd: Math.round(between(seed, 2, 0, 8)),
      impressions: status === 'covered' ? Math.round(between(seed, 3, 3, 220)) : null,
      vol: Math.round(between(seed, 4, 5, 90)) * 10,
   }];
   for (let i = 0; i < supporting; i += 1) {
      kws.push({
         text: SUPPORT_TEMPLATES[(tplBase + i) % SUPPORT_TEMPLATES.length](main),
         isMain: false,
         covered: false,
         position: null,
         kd: Math.round(between(seed, 10 + i, 0, 12)),
         impressions: null,
         vol: Math.round(between(seed, 20 + i, 5, 60)) * 10,
      });
   }
   return kws;
};

export function buildTopicClusters(
   topics: Array<{ id: number; title: string; summary?: string | null }>,
): TopicCluster[] {
   return topics.map((t, idx) => {
      const seed = hashStr(t.title.trim().toLowerCase());
      const u = unit(seed, 0);
      let status: TopicStatus = 'not_covered';
      if (u < 0.55) status = 'covered';
      else if (u < 0.8) status = 'recommended';

      const main = t.title.trim().toLowerCase();
      const keywords = buildKeywords(seed, main, status);
      const covered = keywords.filter((k) => k.covered);
      const notCovered = keywords.filter((k) => !k.covered);

      const vol = keywords.reduce((s, k) => s + k.vol, 0);
      const kd = round1(keywords.reduce((s, k) => s + k.kd, 0) / keywords.length);
      const impressions = covered.reduce((s, k) => s + (k.impressions || 0), 0);
      const position = covered.length
         ? round1(covered.reduce((s, k) => s + (k.position || 0), 0) / covered.length)
         : null;

      const slug = slugify(t.title);
      const groups: KeywordGroup[] = [];
      if (covered.length) groups.push({ url: `/${slug}`, label: `/${slug}`, keywords: covered });
      if (notCovered.length) groups.push({ url: null, label: 'Not Covered', keywords: notCovered });

      const start = hashStr(`${seed}:cmp`) % COMPETITOR_POOL.length;
      const competitors: TopicCompetitor[] = Array.from({ length: 20 }, (_, i) => {
         const domain = COMPETITOR_POOL[(start + i) % COMPETITOR_POOL.length];
         return { domain, path: `/${slug}`, href: `https://${domain}/${slug}` };
      });

      let covBase: number;
      if (status === 'covered') covBase = between(seed, 30, 72, 98);
      else if (status === 'recommended') covBase = between(seed, 30, 38, 68);
      else covBase = between(seed, 30, 8, 40);

      const dims: CoverageDim[] = DIM_LABELS.map((label, i) => ({
         label,
         value: Math.round(Math.min(99, Math.max(4, covBase + between(seed, 40 + i, -18, 18)))),
      }));

      const aiSearch = dims[2].value;
      const aiGap: AiGapItem[] = GAP_LABELS.map((label, i) => {
         const total = 3 + (hashStr(`${seed}:g${i}`) % 17);
         return {
            label,
            total,
            have: Math.min(total, Math.round(total * (aiSearch / 100) * between(seed, 60 + i, 0.5, 1.2))),
         };
      });

      const volNorm = Math.min(1, vol / 1200);
      const oppScore = Math.max(1, Math.min(99, Math.round(0.6 * (100 - dims[0].value) + 40 * volNorm)));
      let tier: Opportunity['tier'] = 'Low';
      if (oppScore >= 80) tier = 'Very High';
      else if (oppScore >= 60) tier = 'High';
      else if (oppScore >= 40) tier = 'Medium';
      const opportunity: Opportunity = {
         score: oppScore,
         tier,
         estGainClicks: Math.round(vol * between(seed, 70, 0.12, 0.5)),
         difficulty: kd < 25 ? 'Easy' : kd < 60 ? 'Medium' : 'Hard',
         priority: oppScore >= 60 ? 'High' : oppScore >= 40 ? 'Medium' : 'Low',
      };

      const subs = AUTH_LABELS.map((label, i) => ({
         label,
         value: Math.round(Math.min(99, Math.max(5, covBase + between(seed, 80 + i, -25, 20)))),
      }));
      const aiAuthority = {
         score: Math.round(subs.reduce((s, x) => s + x.value, 0) / subs.length),
         subs,
      };

      const angle = unit(seed, 90) * Math.PI * 2;
      const mag = 0.12 + 0.72 * (1 - dims[0].value / 100);
      const map = {
         x: Math.cos(angle) * mag,
         y: Math.sin(angle) * mag,
         size: 0.7 + Math.min(1.1, keywords.length * 0.2),
      };

      const fallbackStatuses: ArticleStatus[] = ['Not started', 'In progress', 'Done'];
      const articleStatus: ArticleStatus = status === 'covered'
         ? 'Covered'
         : fallbackStatuses[hashStr(`${seed}:as`) % fallbackStatuses.length];

      return {
         id: t.id ?? idx,
         name: t.title,
         mainKeyword: main,
         keywords,
         groups,
         competitors,
         kd,
         vol,
         position,
         impressions,
         covRatio: `${covered.length ? 1 : 0}/1`,
         status,
         articleStatus,
         dims,
         aiGap,
         opportunity,
         aiAuthority,
         map,
      };
   });
}
