import type { StepFocus, EditMode } from '../../lib/optimizationPlanner';

export type SectionResult = {
   oldHtml: string;
   newHtml: string;
   changed: boolean;
   scores?: { seo: number; overall: number; ai: number };
   adjustments?: Array<{ type: string; snippet: string; sourceDomains: string[] }>;
   focus?: StepFocus;
   mode?: EditMode;
   reason?: string;
};

const store = new Map<string, SectionResult>();

/** App-side store for Auto-Optimize section old/new HTML — keeps the ProseMirror doc light. */
export const optimizeStore = {
   set: (id: string, r: SectionResult) => { store.set(id, r); },
   get: (id: string): SectionResult | undefined => store.get(id),
   has: (id: string) => store.has(id),
   clear: () => { store.clear(); },
};
