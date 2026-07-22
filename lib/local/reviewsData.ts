export type ReviewReplySource = 'ai' | 'manual' | null;

export type ReviewReply = {
  id: string;
  author: string;
  dateLabel: string;
  text: string;
  source: Exclude<ReviewReplySource, null>;
};

export type ReviewItem = {
  id: string;
  author: string;
  rating: 1 | 2 | 3 | 4 | 5;
  dateLabel: string;
  dateIso: string;
  text: string;
  textFull?: string;
  repliedByAi: boolean;
  reply: ReviewReply | null;
};

export type ReviewProgressMonth = {
  label: string;
  stars5: number;
  stars4: number;
  stars3: number;
  stars2: number;
  stars1: number;
  noRating: number;
};

export type ReplyScope = 'onAll' | 'onPositive' | 'onNegative';
export type ReplyTone = 'PROFESSIONAL' | 'FRIENDLY' | 'CASUAL';

export type AiRepliesUiState = {
  enabled: boolean;
  scope: ReplyScope;
  language: string;
  tone: ReplyTone;
  repliedCount: number;
  repliedDelta: number;
  timeSavedMinutes: number;
  timeSavedDeltaMinutes: number;
};

export type ReplyFilter = '' | 'not_replied';
export type RatingFilter = '' | '5' | '4' | '3' | '2' | '1';

export const STAR_COLORS = {
  stars5: '#2FC26E',
  stars4: '#8CD47E',
  stars3: '#F5C518',
  stars2: '#F29964',
  stars1: '#E5484D',
  noRating: '#DAD9DE',
} as const;

export const STAR_LEGEND: { key: keyof typeof STAR_COLORS; label: string }[] = [
  { key: 'stars5', label: '5 Star' },
  { key: 'stars4', label: '4 Star' },
  { key: 'stars3', label: '3 Star' },
  { key: 'stars2', label: '2 Star' },
  { key: 'stars1', label: '1 Star' },
  { key: 'noRating', label: 'No rating' },
];

export const SCOPE_OPTIONS: { value: ReplyScope; label: string }[] = [
  { value: 'onAll', label: 'all new reviews' },
  { value: 'onPositive', label: 'positive reviews only' },
  { value: 'onNegative', label: 'negative reviews only' },
];

export const LANGUAGE_OPTIONS = ['Polish', 'English', 'German', 'Spanish'] as const;

export const TONE_OPTIONS: { value: ReplyTone; label: string }[] = [
  { value: 'PROFESSIONAL', label: 'professional' },
  { value: 'FRIENDLY', label: 'friendly' },
  { value: 'CASUAL', label: 'casual' },
];

export const DEFAULT_AI_REPLIES_UI: AiRepliesUiState = {
  enabled: true,
  scope: 'onAll',
  language: 'Polish',
  tone: 'PROFESSIONAL',
  repliedCount: 12,
  repliedDelta: 6,
  timeSavedMinutes: 36,
  timeSavedDeltaMinutes: 18,
};

/** Last 13 months — sparse 5★ bars matching Semrush sample. */
export const MOCK_REVIEW_PROGRESS: ReviewProgressMonth[] = [
  { label: 'Jul', stars5: 0, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
  { label: 'Aug', stars5: 0, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
  { label: 'Sep', stars5: 0, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
  { label: 'Oct', stars5: 2, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
  { label: 'Nov', stars5: 0, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
  { label: 'Dec', stars5: 0, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
  { label: 'Jan', stars5: 2, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
  { label: 'Feb', stars5: 0, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
  { label: 'Mar', stars5: 1, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
  { label: 'Apr', stars5: 0, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
  { label: 'May', stars5: 0, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
  { label: 'Jun', stars5: 0, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
  { label: 'Jul', stars5: 0, stars4: 0, stars3: 0, stars2: 0, stars1: 0, noRating: 0 },
];

const AI_REPLY_TEMPLATE =
  'Dziękujemy serdecznie za maksymalną ocenę. Jesteśmy zadowoleni, że mogliśmy zapewnić pomoc, której potrzebowałeś. Naszym priorytetem jest świadczenie usług na najwyższym poziomie. Jesteśmy do Twojej dyspozycji, jeśli będziesz miał jakiekolwiek pytania. Zawsze jesteśmy gotowi, aby Ci pomóc ponownie.';

function aiReply(id: string, dateLabel: string, businessName: string): ReviewReply {
  return {
    id,
    author: businessName,
    dateLabel,
    text: AI_REPLY_TEMPLATE,
    source: 'ai',
  };
}

function manualReply(id: string, dateLabel: string, businessName: string, text: string): ReviewReply {
  return {
    id,
    author: businessName,
    dateLabel,
    text,
    source: 'manual',
  };
}

export function buildMockReviews(businessName: string): ReviewItem[] {
  return [
    {
      id: '0d332843f93f49dfb02caf8e7e1e1d35',
      author: 'Adam Bednarczyk',
      rating: 5,
      dateLabel: 'Mar 26',
      dateIso: '2026-03-26',
      text: 'Pełen profesjonalizm i ekspercka wiedza! Współpraca z Aodc to czysta przyjemność. Firma wyróżnia się indywidualnym podejściem do klienta, terminowością oraz głęboką wiedzą techniczną…',
      textFull:
        'Pełen profesjonalizm i ekspercka wiedza!\nWspółpraca z Aodc to czysta przyjemność. Firma wyróżnia się indywidualnym podejściem do klienta, terminowością oraz głęboką wiedzą techniczną w zakresie oferowanych rozwiązań. Zespół inżynierów cechuje się wysoką kulturą pracy i zaangażowaniem. Szczerze polecam każdemu, kto szuka rzetelnego partnera biznesowego.',
      repliedByAi: true,
      reply: aiReply('r1', 'Mar 27', businessName),
    },
    {
      id: '6f56075a5b8448768416d78c26b58679',
      author: 'Waldemar Kubica',
      rating: 5,
      dateLabel: 'Jan 26',
      dateIso: '2026-01-26',
      text: '',
      repliedByAi: true,
      reply: aiReply('r2', 'Jan 27', businessName),
    },
    {
      id: '0b2a7f6796cc4805b46aca17080f500b',
      author: 'Jakub Woźniak',
      rating: 5,
      dateLabel: 'Jan 09',
      dateIso: '2026-01-09',
      text: '',
      repliedByAi: true,
      reply: aiReply('r3', 'Jan 10', businessName),
    },
    {
      id: '595d60b5d1874373a2d4384923dedd6a',
      author: 'Miko Kryspin',
      rating: 5,
      dateLabel: 'Oct 26, 2025',
      dateIso: '2025-10-26',
      text: 'pomoc z vice city to tutaj?\n\n(Translated by Google)\nhelp from vice city is here?',
      repliedByAi: true,
      reply: aiReply('r4', 'Jul 16', businessName),
    },
    {
      id: '8a3429a2ac0b409aa91630f3a47a5b7d',
      author: 'Majonez es',
      rating: 5,
      dateLabel: 'Oct 16, 2025',
      dateIso: '2025-10-16',
      text: 'Bartosz mnie zabrał do tej placówki i dowiedziałem się że pracują nad gta VI. Dali mi zagrać i nawet fajne. Polecam\n\n(Translated by Google)\nBartosz took me to this facility and I learned they were working on GTA VI. They let me play it, and it was pretty cool. I recommend it.',
      repliedByAi: true,
      reply: aiReply('r5', 'Oct 17', businessName),
    },
    {
      id: '893db9b2c17d45509a7f858f8a698de2',
      author: 'Mateusz F.',
      rating: 5,
      dateLabel: 'Feb 07, 2025',
      dateIso: '2025-02-07',
      text: 'Polecam\n\n(Translated by Google)\nI recommend',
      repliedByAi: true,
      reply: aiReply('r6', 'Feb 08', businessName),
    },
    {
      id: 'ad4a6cfdd59d47a9bec44c8b5e5a9513',
      author: 'Bartosz Wiśniewski (Wisnia)',
      rating: 5,
      dateLabel: 'Aug 30, 2024',
      dateIso: '2024-08-30',
      text: "Pracujemy nad GTA6, i RDR3. Polecam, miła atmosfera pracy\n\n(Translated by Google)\nWe're working on GTA6 and RDR3. I recommend it, nice working atmosphere.",
      repliedByAi: false,
      reply: manualReply('r7', 'Sep 01, 2024', businessName, 'Dziękujemy za opinię!'),
    },
    {
      id: '7e56b3b84f424c1189e7df654bcc7d8b',
      author: 'Maciek Wisniewski',
      rating: 5,
      dateLabel: 'May 03, 2023',
      dateIso: '2023-05-03',
      text: '',
      repliedByAi: false,
      reply: manualReply('r8', 'May 04, 2023', businessName, 'Dziękujemy!'),
    },
    {
      id: 'bd8f27b7e48047dabf97bd2bd109f331',
      author: 'Grzegorz Budzanowski',
      rating: 5,
      dateLabel: 'May 15, 2021',
      dateIso: '2021-05-15',
      text: '',
      repliedByAi: false,
      reply: manualReply('r9', 'May 16, 2021', businessName, 'Dziękujemy!'),
    },
    {
      id: '208b49d701434577adfaaacef70b6e7b',
      author: 'Łukasz Windak',
      rating: 5,
      dateLabel: 'Jul 15, 2019',
      dateIso: '2019-07-15',
      text: '',
      repliedByAi: false,
      reply: manualReply('r10', 'Jul 16, 2019', businessName, 'Dziękujemy!'),
    },
    {
      id: '04100d494a3b4cd4bc4784a75a15633f',
      author: 'Boguslaw Kordeczka (Bony)',
      rating: 5,
      dateLabel: 'Jul 23, 2018',
      dateIso: '2018-07-23',
      text: '',
      repliedByAi: false,
      reply: manualReply('r11', 'Jul 24, 2018', businessName, 'Dziękujemy!'),
    },
    {
      id: '3eaee647b577466d9d349a4edd3aeed1',
      author: 'Mateusz Soszka',
      rating: 5,
      dateLabel: 'Apr 05, 2018',
      dateIso: '2018-04-05',
      text: '',
      repliedByAi: false,
      reply: manualReply('r12', 'Apr 06, 2018', businessName, 'Dziękujemy!'),
    },
    {
      id: '666c0a7152174dd7946ae0bb84de5320',
      author: 'łukasz s',
      rating: 4,
      dateLabel: 'Dec 05, 2017',
      dateIso: '2017-12-05',
      text: '',
      repliedByAi: false,
      reply: manualReply('r13', 'Dec 06, 2017', businessName, 'Dziękujemy!'),
    },
    {
      id: 'a9ca37228af04847b33d971236719598',
      author: 'M Wi',
      rating: 5,
      dateLabel: 'Oct 13, 2017',
      dateIso: '2017-10-13',
      text: '',
      repliedByAi: false,
      reply: manualReply('r14', 'Oct 14, 2017', businessName, 'Dziękujemy!'),
    },
    {
      id: 'dc5c52e2e1dc485dbf21f22b9560e32c',
      author: 'Anna Brzozowska',
      rating: 5,
      dateLabel: 'May 12, 2017',
      dateIso: '2017-05-12',
      text: '',
      repliedByAi: false,
      reply: manualReply('r15', 'May 13, 2017', businessName, 'Dziękujemy!'),
    },
  ];
}

export function averageRating(reviews: ReviewItem[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export function ratingDistribution(reviews: ReviewItem[]): Record<1 | 2 | 3 | 4 | 5, number> {
  const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) dist[r.rating] += 1;
  return dist;
}

export function filterReviews(
  reviews: ReviewItem[],
  opts: {
    onlyAi: boolean;
    replyFilter: ReplyFilter;
    ratingFilter: RatingFilter;
  },
): ReviewItem[] {
  return reviews.filter((r) => {
    if (opts.onlyAi && !r.repliedByAi) return false;
    if (opts.replyFilter === 'not_replied' && r.reply) return false;
    if (opts.ratingFilter && String(r.rating) !== opts.ratingFilter) return false;
    return true;
  });
}

export function monthStackTotal(m: ReviewProgressMonth): number {
  return m.stars5 + m.stars4 + m.stars3 + m.stars2 + m.stars1 + m.noRating;
}

export function progressYMax(months: ReviewProgressMonth[]): number {
  const peak = months.reduce((max, m) => Math.max(max, monthStackTotal(m)), 0);
  return Math.max(peak, 2);
}
