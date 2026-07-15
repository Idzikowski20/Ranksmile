export type LocalSetupStep =
  | 'search'
  | 'connect'
  | 'select-gbp'
  | 'confirm'
  | 'creating-location'
  | 'customizing-flow'
  | 'user-role'
  | 'ai-replies'
  | 'ai-replies-enabled'
  | 'map-rank-tracker'
  | 'great-start'
  | 'complete';

export type LocalUserRole =
  | 'business-owner'
  | 'freelancer-agency'
  | 'marketing-manager'
  | 'store-manager'
  | 'employee'
  | 'other';

export type AiRepliesSettings = {
  positiveEnabled: boolean;
  negativeEnabled: boolean;
  language: string;
  tone: string;
  skipped: boolean;
};

export type LocalSetupJobs = {
  listingsStatus: 'pending' | 'running';
  mrtStatus: 'pending' | 'running' | 'done' | 'skipped';
  reviewsStatus: 'enabled' | 'skipped';
  mrtStartedAt: string | null;
  mrtDurationMs: number;
  mrtCompletedAt: string | null;
};

export type BusinessPlace = {
  id: string;
  name: string;
  address: string;
  phone?: string;
};

export type GbpProfile = {
  id: string;
  name: string;
  address: string;
  phone: string;
  website?: string;
  description?: string;
  primaryCategory?: string;
  directoryCategories?: string[];
  hasEditAccess: boolean;
};

export type BusinessCategory = {
  id: string;
  label: string;
  group?: string;
};

export type DayHours = {
  day: string;
  status: 'open' | 'closed';
  openTime?: string;
  closeTime?: string;
};

export type BusinessDetails = {
  name: string;
  address: string;
  phone: string;
  website: string;
  description: string;
  hideAddress: boolean;
  deliversLocally: boolean;
  serviceAreas: string[];
  googleCategories: string[];
  directoryCategories: string[];
  logoUrl?: string;
  coverUrl?: string;
  photoUrls: string[];
  hours: DayHours[];
};

export const DEFAULT_AI_REPLIES: AiRepliesSettings = {
  positiveEnabled: true,
  negativeEnabled: false,
  language: 'Polish',
  tone: 'friendly',
  skipped: false,
};

export type GrowthActionLogEntry = {
  key: string;
  title: string;
  completedAt: string;
};

export type LocalSetupState = {
  step: LocalSetupStep;
  selectedPlace: BusinessPlace | null;
  selectedGbpId: string | null;
  businessDetails: BusinessDetails | null;
  googleAccountEmail: string | null;
  completedAt: string | null;
  userRole: LocalUserRole | null;
  aiReplies: AiRepliesSettings;
  mapRankKeywords: string[];
  setupJobs: LocalSetupJobs | null;
  locationCreatedAt: string | null;
  growthActionsDay: string | null;
  growthActionsCompletedIds: ('setup-agent' | 'add-categories' | 'improve-description')[];
  growthActionsLog: GrowthActionLogEntry[];
};

export const DEFAULT_HOURS: DayHours[] = [
  { day: 'Monday', status: 'open', openTime: '08:00', closeTime: '16:00' },
  { day: 'Tuesday', status: 'open', openTime: '08:00', closeTime: '16:00' },
  { day: 'Wednesday', status: 'open', openTime: '08:00', closeTime: '16:00' },
  { day: 'Thursday', status: 'open', openTime: '08:00', closeTime: '16:00' },
  { day: 'Friday', status: 'open', openTime: '08:00', closeTime: '16:00' },
  { day: 'Saturday', status: 'closed' },
  { day: 'Sunday', status: 'closed' },
];

export const EMPTY_BUSINESS_DETAILS: BusinessDetails = {
  name: '',
  address: '',
  phone: '',
  website: '',
  description: '',
  hideAddress: false,
  deliversLocally: true,
  serviceAreas: [],
  googleCategories: [],
  directoryCategories: [],
  photoUrls: [],
  hours: DEFAULT_HOURS,
};
